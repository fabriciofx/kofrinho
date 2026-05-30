export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  return emailRegex.test(email) && email.length <= 255
}

export function isValidPassword(password: string): boolean {
  const hasUppercase = /[A-Z]/.test(password)
  const hasLowercase = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~]/.test(password)
  const hasMinLength = password.length >= 8

  return hasUppercase && hasLowercase && hasNumber && hasSpecialChar && hasMinLength
}

export function getPasswordValidationErrors(password: string): string[] {
  const errors: string[] = []
  
  if (password.length < 8) errors.push('Mínimo 8 caracteres')
  if (!/[A-Z]/.test(password)) errors.push('Pelo menos uma letra maiúscula')
  if (!/[a-z]/.test(password)) errors.push('Pelo menos uma letra minúscula')
  if (!/[0-9]/.test(password)) errors.push('Pelo menos um número')
  if (!/[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~]/.test(password)) {
    errors.push('Pelo menos um caractere especial (!@#$%^&*)')
  }
  
  return errors
}
