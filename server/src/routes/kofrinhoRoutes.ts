import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import {
  createKofrinho,
  listKofrinhos,
  getKofrinho,
  updateKofrinho,
  deleteKofrinho
} from '../controllers/kofrinhoController.js'
import { createDepositante, listDepositantes, updateDepositante, deleteDepositante } from '../controllers/depositanteController.js'
import { listSolicitacoes, streamSolicitacoesEventos, streamUsuarioEventos } from '../controllers/solicitacaoController.js'

const router = express.Router()

router.use(authMiddleware)

router.post('/', createKofrinho)
router.get('/', listKofrinhos)
router.get('/eventos', streamUsuarioEventos)
router.get('/:id', getKofrinho)
router.put('/:id', updateKofrinho)
router.delete('/:id', deleteKofrinho)

router.get('/:id/solicitacoes/eventos', streamSolicitacoesEventos)
router.get('/:id/solicitacoes', listSolicitacoes)
router.post('/:id/depositantes', createDepositante)
router.get('/:id/depositantes', listDepositantes)
router.put('/:id/depositantes/:depositanteId', updateDepositante)
router.delete('/:id/depositantes/:depositanteId', deleteDepositante)

export default router
