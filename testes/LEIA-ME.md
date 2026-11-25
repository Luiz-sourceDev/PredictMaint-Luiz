# Testes automatizados · PredictMaint

Duas baterias que conferem o sistema inteiro sozinhas:

| Bateria | Ferramenta | O que confere | Quantidade |
| --- | --- | --- | --- |
| **API** (`api/`) | `node:test` (já vem no Node) | Cada rota, cada validação e a tabela de acessos dos 3 perfis | 157 testes |
| **Telas** (`telas/`) | Playwright | Um navegador robô usa o sistema como uma pessoa, no computador e no celular | 24 testes |

## Como rodar (Windows)

1. Ligue o sistema (atalho **Iniciar PredictMaint**).
2. Dê dois cliques em **`Rodar-Testes.bat`**.
3. No fim aparece `TODOS OS TESTES PASSARAM` e o relatório das telas abre no navegador
   (com print e gravação passo a passo de qualquer falha).

Pelo terminal, dentro desta pasta: `npm install`, depois `npm run api`, `npm run telas` ou `npm run todos`.

## O que é testado

**API**
- `01` Saúde e login: os 3 perfis, por e-mail e matrícula, senha errada, perfil que a pessoa não tem, rotas sem login.
- `02` Permissões: 28 rotas × 3 perfis = 84 conferências de "pode / não pode".
- `03` Máquinas: listar, filtrar, cadastrar, código repetido, editar, saúde inválida, desativar.
- `04` Medições e alertas: leitura normal, leitura crítica cria alerta (sem duplicar), reconhecer, valores inválidos, data no futuro, limites.
- `05` Ordens de serviço: criar, quadro, técnico só muda status, gestor muda prioridade/equipe/prazo, concluir.
- `06` Chamados: abrir com e sem foto, arquivo que não é imagem, vira OS automaticamente, a linha do tempo anda com a OS, comentários, funcionário só vê os seus.
- `07` Orçamento: base da máquina, comparativo, servidor recalcula o total, corretiva > preventiva.
- `08` Usuários e acessos: busca, filtros, cadastro, setor obrigatório, e-mail repetido, chaves liga/desliga (sessão cai na hora), desativar/reativar, troca de senha, proteções do gestor.
- `09` Avisos (sininho): enviar urgente com máquina, não lidos, só o dono marca como lido, marcar todos, histórico, validações.
- `10` Dashboard, resumo do menu lateral (bate com o total de máquinas), busca, filtros e acentos.

**Telas**
- Login dos 3 perfis, senha errada, sair.
- Gestor vê e abre todas as telas sem erro; a Planta ao vivo não aparece mais e o endereço antigo leva ao Dashboard; técnico sem Orçamento/Usuários e sem botões de cadastro; endereço digitado à mão é barrado; funcionário só na área de chamados.
- Técnico registra medição e move OS; funcionário abre chamado e acompanha; chamado com foto de 18 MB (o site reduz antes de enviar) e a foto aparece para o funcionário e na OS do gestor.
- Usuários: cadastrar, buscar, filtrar, chaves de acesso, alerta urgente chegando no sininho do técnico, desativar.
- Celular: todas as telas cabem na tela, sem rolagem para o lado.

## Dados

Os testes **não apagam nada**: o que eles criam leva a marca `TST-…` (máquinas) ou `Teste …` (usuários),
e as máquinas e usuários de teste são desativados no fim. Antes de uma apresentação, o `Rodar-Testes.bat`
pergunta se você quer recriar o banco com os dados de exemplo.

## Testar a homologação (Coolify)

```bat
set API_URL=https://api-predictmaint.seudominio.com/api
set SITE_URL=https://predictmaint.seudominio.com
Rodar-Testes.bat
```
