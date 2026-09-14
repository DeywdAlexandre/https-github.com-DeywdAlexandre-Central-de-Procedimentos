import { Router } from 'express';
import { db } from '../../db/index.ts';
import { hearings, policeOfficers, hearingOfficers } from '../../db/schema.ts';
import { requireAuth, requireEditor, AuthRequest } from '../../middleware/auth.ts';
import { parseWhatsAppBatch, groupParsedHearings } from '../../lib/whatsapp-batch-parser.ts';
import { formatDateBR, getTodayDateBR } from '../../lib/deadline-calculator.ts';
import { logAudit } from '../helpers/audit.ts';

export const batchRouter = Router();

// POST /api/batch/preview
batchRouter.post('/preview', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: 'Nenhum texto informado para importação.' });
    }

    const parsedLines = parseWhatsAppBatch(rawText);

    // Cruzar com cadastro existente de policiais (por nome ou apelido)
    const existingOfficers = await db.select().from(policeOfficers);
    const existingHearings = await db.select().from(hearings);

    // Mapeamento tolerante de policiais
    parsedLines.forEach((item) => {
      const itemLower = item.officerName.toLowerCase().trim();
      const match = existingOfficers.find((o) => {
        const fullLower = o.fullName.toLowerCase();
        const shortLower = o.shortName ? o.shortName.toLowerCase() : '';
        const aliases = o.aliases ? o.aliases.toLowerCase() : '';
        return (
          fullLower.includes(itemLower) ||
          (shortLower && (shortLower.includes(itemLower) || itemLower.includes(shortLower))) ||
          (aliases && aliases.includes(itemLower))
        );
      });

      if (match) {
        item.matchedOfficerId = match.id;
        item.matchedOfficerName = `${match.rank} ${match.fullName}`;
      }

      // Checar se audiência já existe no banco (mesmo ofício e data)
      if (item.noticeNumber && item.hearingDate) {
        const dup = existingHearings.find(
          (h) => h.noticeNumber === item.noticeNumber && h.hearingDate === item.hearingDate
        );
        if (dup) {
          item.status = 'duplicado';
          item.issues.push(`Audiência com mesmo ofício (${item.noticeNumber}) e data (${formatDateBR(item.hearingDate)}) já cadastrada no sistema`);
        }
      }
    });

    const grouped = groupParsedHearings(parsedLines);

    res.json({
      totalLines: parsedLines.length,
      lines: parsedLines,
      groups: grouped,
      summary: {
        pronto: parsedLines.filter((l) => l.status === 'pronto').length,
        revisar: parsedLines.filter((l) => l.status === 'revisar').length,
        duplicado: parsedLines.filter((l) => l.status === 'duplicado').length,
      },
    });
  } catch (error: any) {
    console.error('Erro no preview de importação:', error);
    res.status(500).json({ error: 'Falha ao processar prévia da importação.' });
  }
});

// POST /api/batch/commit
batchRouter.post('/commit', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const { groups } = req.body;
    if (!Array.isArray(groups) || groups.length === 0) {
      return res.status(400).json({ error: 'Nenhum registro validado para salvar.' });
    }

    let createdHearingsCount = 0;
    let associatedOfficersCount = 0;
    const errors: string[] = [];

    for (const group of groups) {
      try {
        if (!group.noticeNumber || !group.hearingDate || !group.hearingTime) {
          errors.push(`Grupo ${group.groupKey} com dados essenciais faltando.`);
          continue;
        }

        // Criar audiência
        const [newH] = await db
          .insert(hearings)
          .values({
            noticeNumber: group.noticeNumber,
            hearingDate: group.hearingDate,
            hearingTime: group.hearingTime,
            court: group.court || 'Vara da Justiça Militar Estadual',
            modality: group.modality || 'presencial',
            status: 'agendada',
            createdBy: req.user!.email,
          })
          .returning();

        createdHearingsCount++;

        // Associar policiais
        for (const off of group.officers) {
          let officerId = off.matchedOfficerId;

          // Se policial não existir no banco, cadastrar automaticamente com dados iniciais
          if (!officerId) {
            const [newPol] = await db
              .insert(policeOfficers)
              .values({
                fullName: off.officerName,
                rank: off.rank || 'Sd',
                badge: off.badge || null,
                shortName: off.officerName,
                active: true,
                notes: 'Cadastrado automaticamente via importação em lote de mensagem de WhatsApp',
              })
              .returning();
            officerId = newPol.id;
          }

          // Associar à audiência com ofício pendente
          await db.insert(hearingOfficers).values({
            hearingId: newH.id,
            officerId,
            officialNoticeNumber: group.noticeNumber,
            issueDate: getTodayDateBR(),
            noticeStatus: 'pendente',
          });

          associatedOfficersCount++;
        }
      } catch (grpErr: any) {
        errors.push(`Erro ao importar grupo ${group.groupKey}: ${grpErr.message}`);
      }
    }

    await logAudit('BATCH_IMPORT_HEARINGS', 'hearing', 'multiple', req.user!.email, {
      createdHearingsCount,
      associatedOfficersCount,
      errorsCount: errors.length,
    });

    res.json({
      success: true,
      createdHearingsCount,
      associatedOfficersCount,
      errors,
    });
  } catch (error: any) {
    console.error('Erro ao efetivar importação:', error);
    res.status(500).json({ error: 'Falha ao salvar audiências importadas.' });
  }
});
