import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import {
  createKofrinho,
  listKofrinhos,
  getKofrinho,
  updateKofrinho,
  deleteKofrinho
} from '../controllers/kofrinhoController.js'
import { createDeposito, listDepositos } from '../controllers/depositoController.js'

const router = express.Router()

router.use(authMiddleware)

router.post('/', createKofrinho)
router.get('/', listKofrinhos)
router.get('/:id', getKofrinho)
router.put('/:id', updateKofrinho)
router.delete('/:id', deleteKofrinho)

router.post('/:id/depositos', createDeposito)
router.get('/:id/depositos', listDepositos)

export default router
