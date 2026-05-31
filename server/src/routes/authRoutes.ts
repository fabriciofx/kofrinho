import express from 'express'
import { register, login, refreshToken, requestPasswordReset, resetPassword } from '../controllers/authController.js'

const router = express.Router()

router.post('/register', register)
router.post('/login', login)
router.post('/refresh', refreshToken)
router.post('/forgot-password', requestPasswordReset)
router.post('/reset-password', resetPassword)

export default router
