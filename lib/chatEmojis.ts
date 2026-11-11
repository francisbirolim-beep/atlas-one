// Fonte única para exibição e validação das reações.
export const GRUPOS_EMOJIS_REACAO = [
  { titulo: 'Mais usados', itens: ['👍','❤️','😂','😮','😢','🙏','👏','✅','😍','🔥','🎉','👀'] },
  { titulo: 'Expressões', itens: ['😀','😁','😊','🥰','😘','😎','🤔','😅','😆','😡','😔','😭'] },
  { titulo: 'Gestos e símbolos', itens: ['👎','👌','💪','🤝','🙌','👋','🤗','💯','⭐','💚','💙','🚀'] },
] as const

export const EMOJIS_REACAO: readonly string[] = GRUPOS_EMOJIS_REACAO.flatMap(grupo => [...grupo.itens])
