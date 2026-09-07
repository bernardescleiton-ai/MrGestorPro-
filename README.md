<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/eea01972-6ea3-4c59-b796-98d3d6b00976

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## WhatsApp com imagem e vídeo

A janela de mensagem de renovação agora permite anexar uma imagem ou vídeo sem abrir uma nova janela dentro do app. A mídia é enviada para o Firebase Storage e sua referência fica salva nas configurações do aplicativo; os próximos envios de WhatsApp usam essa mídia automaticamente.

- Imagens: JPG, PNG ou WEBP, até 5 MB.
- Vídeos: MP4, MOV ou WEBM, até 16 MB.
- Em celular/navegador compatível, o envio com mídia usa o compartilhamento nativo de arquivos quando a API Cloud do WhatsApp não está configurada.
- Para envio realmente automático, sem abrir a tela de compartilhamento, configure no servidor `WHATSAPP_CLOUD_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e opcionalmente `WHATSAPP_GRAPH_VERSION`.
- As regras de Storage necessárias estão em `storage.rules` e precisam ser publicadas no projeto Firebase.
