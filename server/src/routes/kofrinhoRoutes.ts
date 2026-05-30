import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { 
  createKofrinho, 
  listKofrinhos, 
  getKofrinho, 
  updateKofrinho, 
  deleteKofrinho 
} from '../controllers/kofrinhoController.js'

const router = express.Router()

router.use(authMiddleware)

router.post('/', createKofrinho)
router.get('/', listKofrinhos)
router.get('/:id', getKofrinho)
router.put('/:id', updateKofrinho)
router.delete('/:id', deleteKofrinho)

export default router
