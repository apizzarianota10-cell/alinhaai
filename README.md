# AlinhaAí

App web feito com [Next.js](https://nextjs.org) (App Router), TypeScript e Tailwind CSS, hospedado na [Vercel](https://vercel.com).

## Como rodar localmente

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Scripts

| Comando         | O que faz                          |
| --------------- | ---------------------------------- |
| `npm run dev`   | Servidor de desenvolvimento        |
| `npm run build` | Build de produção                  |
| `npm run start` | Roda o build de produção           |
| `npm run lint`  | Verifica o código com ESLint       |

## Estrutura

```
src/app/
  layout.tsx    # layout raiz (fontes, metadados, idioma)
  page.tsx      # página inicial
  globals.css   # estilos globais e Tailwind
```

## Variáveis de ambiente

Ficam em `.env.local` (não vai para o Git). Para baixar as variáveis da Vercel:

```bash
vercel env pull .env.local
```

## Deploy

O projeto está ligado à Vercel. Com o repositório conectado, cada push na `main` gera um deploy de produção.
