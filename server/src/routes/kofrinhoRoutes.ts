import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import {
  createKofrinho,
  listKofrinhos,
  getKofrinho,
  updateKofrinho,
  deleteKofrinho
} from '../controllers/kofrinhoController.js'
import { createDepositante, listDepositantes, deleteDepositante } from '../controllers/depositanteController.js'

const router = express.Router()

router.use(authMiddleware)

router.post('/', createKofrinho)
router.get('/', listKofrinhos)
router.get('/:id', getKofrinho)
router.put('/:id', updateKofrinho)
router.delete('/:id', deleteKofrinho)

router.post('/:id/depositantes', createDepositante)
router.get('/:id/depositantes', listDepositantes)
router.delete('/:id/depositantes/:depositanteId', deleteDepositante)

export default router
