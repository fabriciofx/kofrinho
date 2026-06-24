import argon2 from 'argon2'

/**
 * Parâmetros do Argon2id usados para armazenar os hashes de senha.
 *
 * - memoryCost: 65536 KiB = 64 MiB
 * - timeCost:   3 iterações
 * - parallelism: 4 lanes
 */
export const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 64 * 1024, // 64 MiB em KiB
  timeCost: 3,
  parallelism: 4,
}

/**
 * Gera o hash Argon2id de uma senha em texto puro.
 */
export async function hashPassword(senha: string): Promise<string> {
  return argon2.hash(senha, ARGON2_OPTIONS)
}

/**
 * Verifica se a senha em texto puro corresponde ao hash Argon2id armazenado.
 */
export async function verifyPassword(hash: string, senha: string): Promise<boolean> {
  if (!hash) {
    return false
  }

  try {
    return await argon2.verify(hash, senha)
  } catch {
    return false
  }
}
