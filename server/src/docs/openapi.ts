const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Kofrinho API',
    description:
      'API do Kofrinho — cofre digital pessoal para poupança com cobranças recorrentes via Pix.\n\n' +
      '## Autenticação\n' +
      'Rotas protegidas exigem o header `Authorization: Bearer <access_token>`. ' +
      'O access token é obtido em `/api/auth/login` ou `/api/auth/register` e expira em **2 horas**. ' +
      'Use `/api/auth/refresh` para renová-lo com o refresh token (validade de **7 dias**).\n\n' +
      '## Senhas\n' +
      'Armazenadas com **Argon2id** (memory 64 MiB, timeCost 3, parallelism 4). ' +
      'Requisitos: mínimo 8 caracteres, letra maiúscula, minúscula, número e caractere especial (`!@#$%^&*`).',
    version: '1.0.0',
    contact: {
      name: 'Fabrício Barros Cabral',
      url: 'https://mandacaru.org',
    },
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Desenvolvimento local' },
    { url: 'https://api.mandacaru.org', description: 'Produção' },
  ],
  tags: [
    { name: 'Auth', description: 'Registro, login e recuperação de senha' },
    { name: 'Kofrinhos', description: 'Cofres de poupança do usuário' },
    { name: 'Depositantes', description: 'Depositantes recorrentes de um kofrinho' },
    { name: 'Solicitações', description: 'Cobranças Pix geradas para os depositantes' },
    { name: 'Avatares', description: 'Foto de perfil do usuário' },
    { name: 'Saúde', description: 'Health check do servidor' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token JWT obtido em /api/auth/login',
      },
    },
    schemas: {
      // ── Erros ────────────────────────────────────────────────
      Erro: {
        type: 'object',
        properties: {
          erro: { type: 'string', example: 'Mensagem de erro' },
        },
        required: ['erro'],
      },

      // ── Auth ─────────────────────────────────────────────────
      UsuarioPublico: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          nome_completo: { type: 'string', example: 'João Silva' },
          email: { type: 'string', format: 'email', example: 'joao@exemplo.com' },
          foto_avatar: {
            type: 'string',
            nullable: true,
            example: 'uploads/avatars/abc123.jpg',
            description: 'Path relativo ou null',
          },
          criado_em: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Login realizado com sucesso' },
          user: { $ref: '#/components/schemas/UsuarioPublico' },
          token: { type: 'string', description: 'Access token JWT (2h)', example: 'eyJhbGci...' },
          refreshToken: { type: 'string', description: 'Refresh token JWT (7d)', example: 'eyJhbGci...' },
        },
      },

      // ── Kofrinhos ─────────────────────────────────────────────
      Kofrinho: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          nome: { type: 'string', example: 'Viagem para Europa' },
          descricao: { type: 'string', nullable: true, example: 'Fundo para a viagem de férias' },
          user_id: { type: 'integer', example: 1 },
          saldo: {
            type: 'number',
            format: 'float',
            example: 1500.0,
            description: 'Soma das solicitações pagas (pago = 1)',
          },
          criado_em: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
      },

      // ── Depositantes ──────────────────────────────────────────
      Depositante: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          kofrinho_id: { type: 'integer', example: 1 },
          nome: { type: 'string', example: 'Maria Souza' },
          valor: { type: 'number', format: 'float', example: 50.0, description: 'Mínimo R$ 0,50' },
          recorrencia: {
            type: 'string',
            enum: ['diario', 'semanal', 'mensal', 'anual'],
            example: 'mensal',
          },
          email: { type: 'string', format: 'email', example: 'maria@exemplo.com' },
          telefone: {
            type: 'string',
            nullable: true,
            example: '+5511999999999',
            description: 'Número WhatsApp com DDI (opcional)',
          },
          data_inicio: {
            type: 'string',
            format: 'date',
            nullable: true,
            example: '2024-02-01',
            description: 'Data da primeira cobrança no formato AAAA-MM-DD. Se omitida, o envio é imediato.',
          },
          criado_em: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
      },

      // ── Solicitações ──────────────────────────────────────────
      Solicitacao: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          solicitacao_id: {
            type: 'string',
            example: 'sol_abc123',
            description: 'Identificador externo da Confrapix',
          },
          kofrinho_id: { type: 'integer', example: 1 },
          depositante_id: { type: 'integer', example: 1 },
          depositante_nome: { type: 'string', example: 'Maria Souza' },
          valor: { type: 'number', format: 'float', example: 50.0 },
          pago: { type: 'integer', enum: [0, 1], example: 0, description: '0 = a pagar, 1 = paga' },
          pago_em: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            example: '2024-01-20T15:00:00.000Z',
          },
          criado_em: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
        },
      },
    },
  },

  paths: {
    // ══════════════════════════════════════════════════════════════
    // AUTH
    // ══════════════════════════════════════════════════════════════
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Registrar novo usuário',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nome_completo', 'email', 'senha'],
                properties: {
                  nome_completo: { type: 'string', example: 'João Silva' },
                  email: { type: 'string', format: 'email', example: 'joao@exemplo.com' },
                  senha: {
                    type: 'string',
                    example: 'Senha@123',
                    description: 'Mín. 8 chars, maiúscula, minúscula, número, caractere especial',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Usuário criado com sucesso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '400': {
            description: 'Dados inválidos (campos obrigatórios, e-mail ou senha fora dos requisitos)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    erro: { type: 'string', example: 'Senha não atende aos requisitos' },
                    requisitos: { type: 'array', items: { type: 'string' } },
                    falhas: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
          '409': {
            description: 'E-mail já cadastrado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Erro' },
              },
            },
          },
        },
      },
    },

    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Autenticar usuário e obter tokens',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'senha'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'joao@exemplo.com' },
                  senha: { type: 'string', example: 'Senha@123' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login realizado com sucesso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          '400': {
            description: 'Campos obrigatórios ausentes',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '401': {
            description: 'E-mail ou senha inválidos',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
    },

    '/api/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Renovar access token usando refresh token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string', example: 'eyJhbGci...' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Novo access token gerado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string', description: 'Novo access token JWT (2h)' },
                    refreshToken: { type: 'string', description: 'Mesmo refresh token recebido' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Refresh token ausente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '401': {
            description: 'Refresh token inválido ou expirado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
    },

    '/api/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Solicitar e-mail de recuperação de senha',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'joao@exemplo.com' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'E-mail de recuperação enviado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Email de recuperação enviado com sucesso' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'E-mail inválido ou ausente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '404': {
            description: 'Usuário não encontrado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
    },

    '/api/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Redefinir senha com token de recuperação',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'novaSenha'],
                properties: {
                  token: { type: 'string', example: 'abc123def456' },
                  novaSenha: { type: 'string', example: 'NovaSenha@456' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Senha redefinida com sucesso',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Senha redefinida com sucesso' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Token ou nova senha inválidos',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '401': {
            description: 'Token expirado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '404': {
            description: 'Token não encontrado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
    },

    // ══════════════════════════════════════════════════════════════
    // KOFRINHOS
    // ══════════════════════════════════════════════════════════════
    '/api/kofrinhos': {
      get: {
        tags: ['Kofrinhos'],
        summary: 'Listar todos os kofrinhos do usuário autenticado',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Lista de kofrinhos',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    kofrinhos: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Kofrinho' },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Token ausente ou inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
      post: {
        tags: ['Kofrinhos'],
        summary: 'Criar novo kofrinho',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nome'],
                properties: {
                  nome: { type: 'string', maxLength: 100, example: 'Viagem para Europa' },
                  descricao: { type: 'string', nullable: true, example: 'Fundo para as férias de julho' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Kofrinho criado com sucesso',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Kofrinho criado com sucesso' },
                    kofrinho: { $ref: '#/components/schemas/Kofrinho' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Nome ausente ou excede 100 caracteres',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '401': {
            description: 'Token ausente ou inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
    },

    '/api/kofrinhos/eventos': {
      get: {
        tags: ['Kofrinhos'],
        summary: 'Stream SSE de eventos do dashboard (saldo atualizado ao vivo)',
        description:
          'Conexão **Server-Sent Events** persistente. Emite um evento `saldo_atualizado` ' +
          'toda vez que uma solicitação Pix do usuário é confirmada, permitindo que o ' +
          'dashboard atualize os saldos em tempo real sem polling.\n\n' +
          'Heartbeat enviado a cada **30 s** para manter a conexão viva em proxies.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Stream SSE aberto',
            content: {
              'text/event-stream': {
                schema: {
                  type: 'string',
                  example: 'data: {"tipo":"saldo_atualizado"}\n\n',
                },
              },
            },
          },
          '401': {
            description: 'Token ausente ou inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
    },

    '/api/kofrinhos/{id}': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          example: 1,
          description: 'ID do kofrinho',
        },
      ],
      get: {
        tags: ['Kofrinhos'],
        summary: 'Buscar kofrinho por ID',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Kofrinho encontrado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { kofrinho: { $ref: '#/components/schemas/Kofrinho' } },
                },
              },
            },
          },
          '401': {
            description: 'Token ausente ou inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '404': {
            description: 'Kofrinho não encontrado ou não pertence ao usuário',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
      put: {
        tags: ['Kofrinhos'],
        summary: 'Atualizar kofrinho',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nome: { type: 'string', maxLength: 100, example: 'Viagem para Japão' },
                  descricao: { type: 'string', nullable: true, example: 'Novo destino' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Kofrinho atualizado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Kofrinho atualizado com sucesso' },
                    kofrinho: { $ref: '#/components/schemas/Kofrinho' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Nome excede 100 caracteres',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '401': {
            description: 'Token ausente ou inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '404': {
            description: 'Kofrinho não encontrado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
      delete: {
        tags: ['Kofrinhos'],
        summary: 'Deletar kofrinho (cascade: depositantes, solicitações)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Kofrinho deletado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Kofrinho deletado com sucesso' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Token ausente ou inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '404': {
            description: 'Kofrinho não encontrado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
    },

    // ══════════════════════════════════════════════════════════════
    // DEPOSITANTES
    // ══════════════════════════════════════════════════════════════
    '/api/kofrinhos/{id}/depositantes': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          example: 1,
          description: 'ID do kofrinho',
        },
      ],
      get: {
        tags: ['Depositantes'],
        summary: 'Listar depositantes de um kofrinho',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Lista de depositantes',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    depositantes: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Depositante' },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Token ausente ou inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '404': {
            description: 'Kofrinho não encontrado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
      post: {
        tags: ['Depositantes'],
        summary: 'Cadastrar depositante e criar agendamento de cobrança',
        description:
          'Cria o depositante e um agendamento recorrente. ' +
          'Se `data_inicio` não for informada, o primeiro envio ocorre imediatamente. ' +
          'O sistema envia um e-mail com o QR Code Pix e (opcionalmente, se `telefone` for ' +
          'informado) uma mensagem WhatsApp com o link da página de pagamento.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nome', 'valor', 'recorrencia', 'email'],
                properties: {
                  nome: { type: 'string', example: 'Maria Souza' },
                  valor: {
                    type: 'number',
                    format: 'float',
                    minimum: 0.5,
                    example: 50.0,
                    description: 'Valor mínimo R$ 0,50',
                  },
                  recorrencia: {
                    type: 'string',
                    enum: ['diario', 'semanal', 'mensal', 'anual'],
                    example: 'mensal',
                  },
                  email: { type: 'string', format: 'email', example: 'maria@exemplo.com' },
                  telefone: {
                    type: 'string',
                    nullable: true,
                    example: '+5511999999999',
                    description: 'Número WhatsApp com DDI. Se informado, envia link via WhatsApp.',
                  },
                  data_inicio: {
                    type: 'string',
                    format: 'date',
                    nullable: true,
                    example: '2024-02-01',
                    description: 'Data da primeira cobrança (AAAA-MM-DD). Omitir = envio imediato.',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Depositante criado e agendamento iniciado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Depositante criado com sucesso' },
                    depositante: { $ref: '#/components/schemas/Depositante' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Campos inválidos (nome, valor, recorrência, e-mail ou data)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '401': {
            description: 'Token ausente ou inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '404': {
            description: 'Kofrinho não encontrado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
    },

    '/api/kofrinhos/{id}/depositantes/{depositanteId}': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          example: 1,
          description: 'ID do kofrinho',
        },
        {
          name: 'depositanteId',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          example: 1,
          description: 'ID do depositante',
        },
      ],
      put: {
        tags: ['Depositantes'],
        summary: 'Atualizar depositante',
        description:
          'Atualiza os campos informados. Quando `recorrencia` ou `data_inicio` mudam, ' +
          'o agendamento é atualizado automaticamente.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                minProperties: 1,
                properties: {
                  nome: { type: 'string', example: 'Maria Silva' },
                  valor: { type: 'number', format: 'float', minimum: 0.5, example: 75.0 },
                  recorrencia: {
                    type: 'string',
                    enum: ['diario', 'semanal', 'mensal', 'anual'],
                    example: 'semanal',
                  },
                  email: { type: 'string', format: 'email', example: 'maria.nova@exemplo.com' },
                  telefone: { type: 'string', nullable: true, example: '+5511888888888' },
                  data_inicio: {
                    type: 'string',
                    format: 'date',
                    nullable: true,
                    example: '2024-03-01',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Depositante atualizado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Depositante atualizado com sucesso' },
                    depositante: { $ref: '#/components/schemas/Depositante' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Campos inválidos ou nenhum campo informado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '401': {
            description: 'Token ausente ou inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '404': {
            description: 'Kofrinho ou depositante não encontrado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
      delete: {
        tags: ['Depositantes'],
        summary: 'Remover depositante (cascade: agendamentos)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Depositante removido',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Depositante removido com sucesso' },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Token ausente ou inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '404': {
            description: 'Kofrinho ou depositante não encontrado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
    },

    // ══════════════════════════════════════════════════════════════
    // SOLICITAÇÕES
    // ══════════════════════════════════════════════════════════════
    '/api/kofrinhos/{id}/solicitacoes': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          example: 1,
          description: 'ID do kofrinho',
        },
      ],
      get: {
        tags: ['Solicitações'],
        summary: 'Listar solicitações de pagamento de um kofrinho',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Lista de solicitações (pagas e a pagar)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    solicitacoes: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Solicitacao' },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Token ausente ou inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '404': {
            description: 'Kofrinho não encontrado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
    },

    '/api/kofrinhos/{id}/solicitacoes/eventos': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'integer' },
          example: 1,
          description: 'ID do kofrinho',
        },
      ],
      get: {
        tags: ['Solicitações'],
        summary: 'Stream SSE de confirmações de pagamento do kofrinho',
        description:
          'Conexão **Server-Sent Events** persistente. Emite um evento `solicitacao_confirmada` ' +
          'quando a Confrapix confirma um pagamento via webhook. ' +
          'Heartbeat a cada **30 s**.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Stream SSE aberto',
            content: {
              'text/event-stream': {
                schema: {
                  type: 'string',
                  example: 'data: {"tipo":"solicitacao_confirmada"}\n\n',
                },
              },
            },
          },
          '401': {
            description: 'Token ausente ou inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '404': {
            description: 'Kofrinho não encontrado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
    },

    '/api/solicitacoes/{solicitacaoId}': {
      post: {
        tags: ['Solicitações'],
        summary: 'Webhook Confrapix — confirmar pagamento',
        description:
          'Chamado pela **Confrapix** quando o pagamento Pix é confirmado. ' +
          'Não requer autenticação. Idempotente: chamadas repetidas retornam 200 sem reprocessar.',
        parameters: [
          {
            name: 'solicitacaoId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'sol_abc123',
            description: 'Identificador externo da Confrapix',
          },
        ],
        responses: {
          '200': {
            description: 'Confirmação processada (ou já estava confirmada)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Solicitação confirmada com sucesso' },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Solicitação não encontrada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
    },

    '/solicitacoes/{solicitacaoId}': {
      get: {
        tags: ['Solicitações'],
        summary: 'Página de pagamento Pix (HTML público)',
        description:
          'Retorna uma página **HTML** com o QR Code e o código Pix copia-e-cola. ' +
          'Acessada pelo depositante diretamente no browser. ' +
          'Não é uma chamada de API — responde `text/html`.',
        parameters: [
          {
            name: 'solicitacaoId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'sol_abc123',
          },
        ],
        responses: {
          '200': {
            description: 'Página HTML renderizada',
            content: { 'text/html': { schema: { type: 'string' } } },
          },
          '404': {
            description: 'Página HTML com mensagem de erro',
            content: { 'text/html': { schema: { type: 'string' } } },
          },
        },
      },
    },

    '/solicitacoes/{solicitacaoId}/qrcode.png': {
      get: {
        tags: ['Solicitações'],
        summary: 'Imagem PNG do QR Code Pix',
        description: 'Retorna a imagem PNG do QR Code da solicitação. Cache de 24 h.',
        parameters: [
          {
            name: 'solicitacaoId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: 'sol_abc123',
          },
        ],
        responses: {
          '200': {
            description: 'Imagem PNG',
            content: { 'image/png': { schema: { type: 'string', format: 'binary' } } },
          },
          '404': {
            description: 'QR Code não encontrado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
    },

    // ══════════════════════════════════════════════════════════════
    // AVATARES
    // ══════════════════════════════════════════════════════════════
    '/api/avatars/upload': {
      post: {
        tags: ['Avatares'],
        summary: 'Enviar foto de perfil',
        description: 'Aceita JPEG ou PNG. Substitui o avatar anterior automaticamente.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['avatar'],
                properties: {
                  avatar: {
                    type: 'string',
                    format: 'binary',
                    description: 'Arquivo de imagem (JPEG ou PNG)',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Avatar salvo com sucesso',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Avatar enviado com sucesso' },
                    user: { $ref: '#/components/schemas/UsuarioPublico' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Arquivo ausente ou tipo inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '401': {
            description: 'Token ausente ou inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '404': {
            description: 'Usuário não encontrado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
    },

    '/api/avatars': {
      delete: {
        tags: ['Avatares'],
        summary: 'Remover foto de perfil',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Avatar removido com sucesso',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Avatar removido com sucesso' },
                    user: { $ref: '#/components/schemas/UsuarioPublico' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Usuário não possui avatar',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '401': {
            description: 'Token ausente ou inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
          '404': {
            description: 'Usuário não encontrado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
          },
        },
      },
    },

    // ══════════════════════════════════════════════════════════════
    // SAÚDE
    // ══════════════════════════════════════════════════════════════
    '/api/health': {
      get: {
        tags: ['Saúde'],
        summary: 'Health check do servidor',
        responses: {
          '200': {
            description: 'Servidor operacional',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    message: { type: 'string', example: 'Server running on port 3000' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}

export default spec
