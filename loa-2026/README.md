# Portal da DF · CABW

Portal estático para GitHub Pages: HOME, Prestação de contas e Pagamentos LOA 2026.

A base pública está em `dados.json` (objeto com campo `data`). O portal lê esse arquivo na abertura. Atualizações de pagamentos devem modificar somente esse arquivo; não alterar o index.html da raiz do repositório nem os dados de prestação de contas.

Fonte: arquivo **Pagamentos LOA 2026 CABW.csv**, ID `1vSKMEtAoZemky6ZUvtqC0pbTXIZD9zP5`, na pasta **LOA 2026**, ID `1cts6q4qAOZwsw3Vtz_Gq9g3cFDVuFCvU` do Google Drive. A fonte permanece privada; o acesso usa os conectores autorizados.

## Atualizar dados

Obter o CSV atual e a base atual do GitHub. Executar:

```sh
node atualizar-loa.cjs fonte.csv dados.json novos-dados.json
```

O programa aceita CSV normal ou envelope JSON com ContentBytes em base64; detecta UTF-16/UTF-8 e separadores. Usa a mesma transformação Tesouro do portal original. Processa somente a última competência da fonte (2026), posições acumuladas em USD. Pago e liquidado iguais; crédito recebido e percentuais preservados. Mantém exatamente os demais meses e rejeita competências anteriores à última publicada. Retorna changed=false sem criar arquivo quando os registros são iguais.

Validar resumo e histórico, obter SHA atual do arquivo e publicar novos-dados.json com GitHub update_file. Se SHA mudar, refazer a mesclagem. Nunca incluir credenciais ou URLs de download assinadas no repositório.

## Conferência manual

O botão Conferir planilha abre uma prévia local que dura apenas a sessão; não publica dados. A publicação compartilhada ocorre pela atualização autorizada de dados.json no GitHub.

## Código

Fontes React em app/ e lib/, entry.tsx e update-cli.ts; portal.js é o bundle de produção. style.css mantém o CSS original compilado. As imagens foram preservadas em WebP. Não há dependência da autenticação nem do armazenamento do Sites nesta cópia.

## Controle de diferido

O controle usa lib/deferred-data.json, com posições mensais por fonte, em USD. O histórico inicial recebido vai de janeiro a outubro/2026. A seleção da prestação permanece agosto e setembro; cada referência mostra somente o histórico até aquele mês. Não somar posições mensais. O diferido desta base é disponibilidade financeira menos compromissos; não corresponde à rubrica de cancelamentos de PO do SISCAB nem ao resultado consolidado do DCF.

Para a próxima carga, aceitar somente o mês enviado (ou os meses presentes no arquivo):

```sh
node atualizar-diferido.cjs fonte.xlsx lib/deferred-data.json nova-base-diferido.json
```

O importador usa xlsx, valida os cabeçalhos, os valores por fonte, a equação e os totais até o centavo. Substitui apenas as competências incluídas no novo arquivo e mantém exatamente as demais; não carrega valores de um mês em outro. Validar os totais, substituir lib/deferred-data.json e recompilar portal.js com React JSX automático. Atualizar a versão de portal.js no index.html e publicar os arquivos juntos. Não modificar dados.json de pagamentos nem as demais prestações nessa carga.
