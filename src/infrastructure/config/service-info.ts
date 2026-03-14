/**
 * INFORMACION DE TU NEGOCIO
 * Edita este archivo con los datos reales de tu servicio de cine.
 * El bot usará esta información para responder a los clientes.
 */
export const SERVICE_INFO = {
  businessName: "Connect World",

  description: `
Ofrecemos un servicio de streaming premium con acceso a más de 11,500 canales en vivo, 55,000 películas y 15,000 series. Nuestro objetivo es brindar entretenimiento ilimitado con una plataforma fácil de usar compatible con Smart TV, Firestick, teléfonos, tablets y computadoras.
  `.trim(),

  services: `
- Plan Básico: 1 dispositivo
  - 1 mes: $10
  - 2 meses: $20
  - 3 meses: $30
  - 6 meses: $60
  - 12 meses: $120

- Plan Estándar: 2 dispositivos
  - 1 mes: $15
  - 2 meses: $25
  - 3 meses: $35
  - 6 meses: $70
  - 12 meses: $140

- Plan Premium: 3 dispositivos
  - 1 mes: $15
  - 2 meses: $30
  - 3 meses: $45
  - 6 meses: $90
  - 12 meses: $149
  `.trim(),

  schedule: `
- Servicio disponible: 24/7 (los usuarios pueden acceder al contenido en cualquier momento)
- Soporte al cliente: Atención disponible 24/7 para ayuda y consultas
- Mantenimiento programado: Martes 2am - 4am (pueden ocurrir interrupciones breves)
  `.trim(),

  location: `
- Servicio 100% en línea
- Sitio web: https://connect-world.it.com/
- Email de soporte: connectworld2008@gmail.com
  `.trim(),

  compatibleDevices: `
- Dispositivos compatibles:
  - 📺 Smart TV (Samsung, LG, Android TV)
  - 🔥 Amazon Fire TV Stick
  - 📱 Teléfonos móviles (Android y iPhone)
  - 📱 Tablets (Android y iPad)
  - 💻 Computadoras (Windows y Mac)
  - 📦 TV Box con Android
  `.trim(),

  paymentMethods: `
- Métodos de pago disponibles:
  - 💳 Tarjeta de crédito
  - 💳 Tarjeta de débito
  - 🅿️ PayPal
  - 🍎 Apple Pay

- Instrucciones de pago:
  Visita https://connect-world.it.com/, selecciona tu plan, completa tus datos y elige el método de pago para finalizar la compra de forma rápida y segura.
  `.trim(),

  referralProgram: `
- Programa disponible para planes Standard y Premium.
- Comparte tu usuario de Connect World como código de referido.
- Recompensas por referidos:
  - Por cada 5 referidos que contraten plan Standard o Premium: 1 mes gratis.
  - Si tu referido compra un plan de 6 meses: 1 mes gratis para ti.
  - Si tu referido compra un plan anual (12 meses): 2 meses gratis para ti.
- Como funciona:
  1. Ten un plan Standard o Premium activo.
  2. Comparte tu usuario como código de referido.
  3. Tu referido ingresa tu código el cual es tu nombre de usuario con el que ingresas a la programacion al contratar un plan Standard o Premium.
  4. Cuando cumplas una de estas condiciones escribenos para hacerte la activacion de los meses que tengas disponible como recompensa de referido.
  `.trim(),

  demo: `
- Ofrecemos demos gratuitas de 1 hora para que puedas probar el servicio antes de comprar.
- Durante la demo tienes acceso completo a la programación: canales en vivo, películas y series.
- Para solicitar una demo solo escríbenos y te la activamos de inmediato.
- No se requiere tarjeta de crédito ni datos de pago para la demo.
  `.trim(),

  // Links e imágenes de descarga por dispositivo
  // Rellena los links y las imageUrl con los valores reales de tu app
  deviceDownloads: [
    {
      keywords: ['android', 'celular', 'telefono', 'teléfono', 'samsung', 'xiaomi', 'motorola', 'huawei'],
      name: 'Android',
      instructions: 'Descarga la app desde Google Play Store:',
      downloadUrl: 'https://play.google.com/store/apps/details?id=com.maxtv.flashpremium&hl=es',
      imageUrl: 'https://play-lh.googleusercontent.com/UeWXG5XifPErfEpzFU0Uwxt0Y1lWmR7h06lCKUHMfpyFfKvLi5kNtWLGeCUZHfwBxzM=w240-h480-rw', // URL pública de imagen/QR (opcional)
    },
    {
      keywords: ['iphone', 'ios', 'apple', 'ipad'],
      name: 'iPhone / iPad',
      instructions: 'Descarga la app desde el App Store:',
      downloadUrl: 'https://apps.apple.com/app/TU_APP_ID',
      imageUrl: '',
    },
    {
      keywords: ['firestick', 'fire stick', 'fire tv', 'amazon'],
      name: 'Amazon Fire TV Stick',
      instructions: 'Descarga la app desde la Amazon App Store:',
      downloadUrl: 'https://www.amazon.com/dp/TU_APP_ID',
      imageUrl: '',
    },
    {
      keywords: ['smart tv', 'smarttv', 'televisor', 'television', 'tele'],
      name: 'Smart TV',
      // Cuando el usuario dice "Smart TV" sin marca, el bot preguntará la marca
      brands: [
        {
          keywords: ['samsung'],
          name: 'Samsung',
          instructions: 'En tu Samsung TV ve a Smart Hub > Apps y busca la app, o instálala desde aquí:',
          downloadUrl: 'https://apps.samsung.com/TU_APP_ID',
          imageUrl: '', // URL pública de imagen/QR para Samsung
        },
        {
          keywords: ['lg'],
          name: 'LG',
          instructions: 'En tu LG TV ve a LG Content Store y busca la app, o instálala desde aquí:',
          downloadUrl: 'https://us.lgappstv.com/TU_APP_ID',
          imageUrl: '', // URL pública de imagen/QR para LG
        },
        {
          keywords: ['android tv', 'androidtv', 'tcl', 'hisense', 'philips', 'sony'],
          name: 'Android TV',
          instructions: 'En tu Android TV ve a Google Play Store y busca la app, o instálala desde aquí:',
          downloadUrl: 'https://play.google.com/store/apps/details?id=TU_APP_ID',
          imageUrl: '', // URL pública de imagen/QR para Android TV
        },
      ],
    },
    {
      keywords: ['tv box', 'tvbox', 'box android', 'android box'],
      name: 'TV Box Android',
      instructions: 'Descarga la app desde Google Play Store en tu TV Box:',
      downloadUrl: 'https://play.google.com/store/apps/details?id=TU_APP_ID',
      imageUrl: '',
    },
    {
      keywords: ['computadora', 'pc', 'windows', 'mac', 'laptop', 'computador'],
      name: 'Computadora',
      instructions: 'Accede directamente desde tu navegador, no necesitas instalar nada:',
      downloadUrl: 'https://connect-world.it.com/',
      imageUrl: '',
    },
  ],
};
