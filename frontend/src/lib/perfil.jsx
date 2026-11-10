'use client';
/* Perfil de quem está logado ('gestor' | 'tecnico' | 'funcionario').
   Lido depois de montar a tela, porque o login fica no navegador. */
import { useState } from 'react';
import { getUser } from './util';

// As telas que usam isto só aparecem depois do login (o Painel não renderiza nada antes),
// então ler o navegador já na primeira renderização é seguro.
export function usePerfil() {
  const [p] = useState(() => (typeof window === 'undefined' ? null : getUser()?.perfil || null));
  return p;
}
