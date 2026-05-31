import express from 'express'
import { uploadMiddleware } from '../config/multer.js'
import { uploadAvatar, deleteAvatar } from '../controllers/avatarController.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()

router.post('/upload', authMiddleware, uploadMiddleware.single('avatar'), uploadAvatar)
router.delete('/', authMiddleware, deleteAvatar)

export default router
