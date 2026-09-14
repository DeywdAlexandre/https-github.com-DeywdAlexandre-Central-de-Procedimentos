import { Router } from 'express';
import { db } from '../../db/index.ts';
import { hearings, policeOfficers, hearingOfficers } from '../../db/schema.ts';
import { eq } from 'drizzle-orm';
import { requireAuth, requireEditor, AuthRequest } from '../../middleware/auth.ts';
import { parseOfficialNotice } from '../../lib/official-notice-parser.ts';
import { getTodayDateBR } from '../../lib/deadline-calculator.ts';
import { logAudit } from '../helpers/audit.ts';


export const noticesRouter = Router();

// POST /api/official-notice/preview
noticesRouter.post('/preview', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText || typeof rawText !== 'string') {
      return res.status(400).json({ error: 'Texto do ofício não informado.' });
    }

    const parsed = parseOfficialNotice(rawText);

    // Carregar policiais cadastrados para cruzar por matrícula ou nome
    const existingOfficers = await db.select().from(policeOfficers);
    const existingHearings = await db.select().from(hearings);

    // Cruzar cada policial detectado
    parsed.officers = parsed.officers.map((off) => {
      let matchedOfficerId: number | undefined;
      let matchedOfficerName: string | undefined;
      let isNew = true;

      // 1. Tentar por matrícula
      if (off.badge) {
        const cleanBadge = off.badge.replace(/[^0-9]/g, '');
        const matchByBadge = existingOfficers.find((o) => {
          if (!o.badge) return false;
          const oClean = o.badge.replace(/[^0-9]/g, '');
          return oClean === cleanBadge || o.badge.trim() === off.badge.trim();
        });
        if (matchByBadge) {
          matchedOfficerId = matchByBadge.id;
          matchedOfficerName = `${matchByBadge.rank} ${matchByBadge.fullName}`;
          isNew = false;
        }
      }

      // 2. Tentar por nome completo ou partes
      if (!matchedOfficerId && off.fullName) {
        const offNameLower = off.fullName.toLowerCase().trim();
        const matchByName = existingOfficers.find((o) => {
          const oFullLower = o.fullName.toLowerCase().trim();
          const oShortLower = o.shortName ? o.shortName.toLowerCase().trim() : '';
          return (
            oFullLower === offNameLower ||
            (offNameLower.length > 5 && oFullLower.includes(offNameLower)) ||
            (oFullLower.length > 5 && offNameLower.includes(oFullLower)) ||
            (oShortLower && (oShortLower === offNameLower || offNameLower.includes(oShortLower)))
          );
        });
        if (matchByName) {
          matchedOfficerId = matchByName.id;
          matchedOfficerName = `${matchByName.rank} ${matchByName.fullName}`;
          isNew = false;
        }
      }

      return {
        ...off,
        matchedOfficerId,
        matchedOfficerName,
        isNew,
      };
    });

    // Verificar duplicidade de audiência
    let duplicateHearing: any = null;
    if (parsed.hearingDate) {
      const matchNotice = existingHearings.find(
        (h) =>
          (h.noticeNumber === parsed.noticeNumber || (parsed.processNumber && h.noticeNumber.includes(parsed.processNumber))) &&
          h.hearingDate === parsed.hearingDate
      );
      if (matchNotice) {
        duplicateHearing = {
          id: matchNotice.id,
          noticeNumber: matchNotice.noticeNumber,
          hearingDate: matchNotice.hearingDate,
          hearingTime: matchNotice.hearingTime,
          court: matchNotice.court,
          status: matchNotice.status,
        };
      }
    }

    res.json({
      parsed,
      duplicateHearing,
    });
  } catch (error: any) {
    console.error('Erro no parser do ofício:', error);
    res.status(500).json({ error: 'Falha ao processar texto do ofício judicial.' });
  }
});

// POST /api/official-notice/commit
noticesRouter.post('/commit', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const {
      noticeNumber,
      processNumber,
      seiNumber,
      hearingDate,
      hearingTime,
      court,
      modality,
      location,
      notes,
      officers,
    } = req.body;

    if (!noticeNumber || !hearingDate || !hearingTime || !court) {
      return res.status(400).json({
        error: 'Número de referência/processo, data, horário e vara são obrigatórios.',
      });
    }

    // 1. Inserir audiência
    const [newHearing] = await db
      .insert(hearings)
      .values({
        noticeNumber: noticeNumber.trim(),
        seiNumber: seiNumber ? seiNumber.trim() : null,
        hearingDate,
        hearingTime,
        court: court.trim(),
        modality: modality || 'presencial',
        location: location ? location.trim() : null,
        notes: notes ? notes.trim() : null,
        status: 'agendada',
        createdBy: req.user!.email,
      })
      .returning();

    // 2. Processar policiais convocados
    const associatedOfficers = [];
    const officersList = Array.isArray(officers) ? officers : [];

    for (const off of officersList) {
      let officerId = off.matchedOfficerId;

      // Se não veio com matchedOfficerId, tentar buscar por matrícula ou nome antes de inserir
      if (!officerId && off.badge) {
        const cleanBadge = off.badge.replace(/[^0-9]/g, '');
        const allPol = await db.select().from(policeOfficers);
        const match = allPol.find((p) => {
          if (!p.badge) return false;
          return p.badge.replace(/[^0-9]/g, '') === cleanBadge || p.badge.trim() === off.badge.trim();
        });
        if (match) officerId = match.id;
      }

      if (!officerId && off.fullName) {
        const offName = off.fullName.trim().toLowerCase();
        const allPol = await db.select().from(policeOfficers);
        const match = allPol.find((p) => p.fullName.trim().toLowerCase() === offName);
        if (match) officerId = match.id;
      }

      // Se for realmente um novo policial, cadastrar com perfil completo no diretório
      if (!officerId) {
        const [newPol] = await db
          .insert(policeOfficers)
          .values({
            fullName: off.fullName.trim(),
            rank: off.rank || 'Sd',
            badge: off.badge ? off.badge.trim() : null,
            phone: off.phone ? off.phone.trim() : null,
            shortName: off.fullName.trim(),
            active: true,
            notes: `Cadastrado automaticamente via importação de Ofício Judicial (${noticeNumber})`,
          })
          .returning();
        officerId = newPol.id;
      } else {
        // Se já existe, enriquecer os dados que porventura estejam vazios (telefone, matrícula)
        const [existing] = await db
          .select({ phone: policeOfficers.phone, badge: policeOfficers.badge })
          .from(policeOfficers)
          .where(eq(policeOfficers.id, officerId))
          .limit(1);

        const updateFields: any = {};
        if (existing) {
          if (!existing.phone && off.phone) {
            updateFields.phone = off.phone.trim();
          }
          if (!existing.badge && off.badge) {
            updateFields.badge = off.badge.trim();
          }
          if (Object.keys(updateFields).length > 0) {
            updateFields.updatedAt = new Date();
            await db
              .update(policeOfficers)
              .set(updateFields)
              .where(eq(policeOfficers.id, officerId));
          }
        }
      }

      // Associar à audiência em hearingOfficers
      const [link] = await db
        .insert(hearingOfficers)
        .values({
          hearingId: newHearing.id,
          officerId,
          officialNoticeNumber: noticeNumber.trim(),
          issueDate: getTodayDateBR(),
          noticeStatus: 'pendente',
          notes: off.email ? `E-mail: ${off.email}` : null,
        })
        .returning();

      associatedOfficers.push(link);
    }

    // Registrar log de auditoria detalhado
    await logAudit('IMPORT_OFFICIAL_NOTICE_HEARING', 'hearing', newHearing.id, req.user!.email, {
      noticeNumber,
      processNumber,
      hearingDate,
      hearingTime,
      court,
      modality,
      officersCount: associatedOfficers.length,
    });

    res.json({
      success: true,
      hearing: newHearing,
      associatedOfficersCount: associatedOfficers.length,
    });
  } catch (error: any) {
    console.error('Erro ao salvar audiência do ofício:', error);
    res.status(500).json({ error: 'Falha ao registrar audiência importada do ofício.' });
  }
});
