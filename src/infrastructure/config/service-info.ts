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

  technicalSupport: `
=== GUÍA DE DIAGNÓSTICO TÉCNICO ===

PASO 1 — IDENTIFICAR SI ES GENERAL O ESPECÍFICO:
Pregunta siempre primero si el problema es en todo el servicio o solo en cierto contenido.
- Si falla TODO (canales en vivo, películas, series) → apunta a la conexión del usuario o a la app.
- Si falla solo cierto contenido (un canal, una película, una categoría) → apunta al servidor de ese contenido o a alta demanda en ese stream.

PASO 2 — SÍNTOMAS Y SU CAUSA MÁS PROBABLE:
- Buffering / se congela / círculo girando: velocidad de internet insuficiente en ese momento, o ese stream con alta demanda de usuarios.
- Sin imagen pero con audio (o viceversa): problema puntual con ese stream específico.
- Pantalla negra / no carga: stream caído temporalmente, o app que necesita reiniciarse.
- Se corta cada ciertos minutos: sesión expirada, conflicto por usar el mismo usuario en múltiples dispositivos a la vez, o límite de conexiones del plan alcanzado.
- Imagen pixelada o de baja calidad: ancho de banda insuficiente en ese momento.
- Todo funciona en un dispositivo pero no en otro: problema aislado en ese dispositivo (app, caché, versión desactualizada).

PASO 3 — PREGUNTAS DE DIAGNÓSTICO (de una en una, nunca como lista):
1. ¿El problema es en todo el servicio o solo en cierto contenido?
2. ¿Qué contenido específico está intentando ver? (canal en vivo, película, serie)
3. ¿Qué dispositivo está usando?
4. ¿Está en WiFi o datos móviles?
5. ¿El problema ocurre ahora mismo o ya se normalizó?
6. ¿Ha cerrado la app completamente y vuelto a abrirla?

PASO 4 — ESCENARIOS Y CÓMO RESPONDER:

ESCENARIO A — Falla solo en cierto contenido (un canal, una película, una serie) pero el resto funciona bien:
El stream de ese contenido específico puede estar experimentando alta demanda o una interrupción temporal en el proveedor de ese contenido. No es un problema del servicio en general ni de la conexión del usuario.
Cómo responder: Reconocer el inconveniente, disculparse, explicar que ese contenido específico puede estar con alta demanda o una interrupción temporal, informar que el equipo lo verifica, sugerir intentar otro contenido similar mientras se normaliza o esperar unos minutos y reintentar. NO culpes al internet del usuario si el resto del servicio funciona bien.

ESCENARIO B — Falla solo durante eventos en vivo o transmisiones en tiempo real:
Los streams en vivo concentran muchos usuarios simultáneos y pueden saturarse en momentos de alta demanda.
Cómo responder: Reconocer que las transmisiones en vivo pueden tener picos de demanda, disculparse, sugerir esperar unos minutos y reintentar, o probar desde otro dispositivo.

ESCENARIO C — Falla todo el servicio, usuario en datos móviles:
Los datos móviles pueden ser inestables según la ubicación, hora y saturación de la red del operador, incluso con 5G. El servicio requiere mínimo 25 Mbps estables.
Cómo responder: Explicar que los datos móviles pueden variar, preguntar si puede probar en WiFi para descartar la conexión.

ESCENARIO D — Falla todo el servicio, usuario en WiFi:
Puede ser el router con caché lleno, el proveedor de internet con problemas, o demasiados dispositivos en la red consumiendo ancho de banda.
Cómo responder: Pedir que reinicie el router (desenchufar 30 segundos), reinicie la app, y pruebe de nuevo.

ESCENARIO E — El problema ya se resolvió solo:
Confirmar que la cuenta está activa, disculparse por el inconveniente, agradecer la paciencia e invitar a reportar si vuelve a ocurrir.

ESCENARIO F — El problema persiste en un dispositivo pero funciona en otro:
El problema está aislado en ese dispositivo. Pasos: desinstalar y reinstalar la app, limpiar caché, verificar que la app esté actualizada.

ESCENARIO G — El usuario dice que las credenciales no le funcionan (usuario o contraseña incorrectos):
La causa más común es que el usuario escribió mal el usuario o la contraseña (confundió mayúsculas, minúsculas, un número por una letra, añadió un espacio, etc.).
Cómo responder: Primero, pídele amablemente que verifique que está copiando el usuario y la contraseña exactamente como se los enviaste, respetando cada carácter. Si dice que sí los copió bien, pídele que te envíe una captura de la pantalla de error para ver qué mensaje le aparece. Con esa captura podrás identificar si es un error de credenciales, un error de conexión, un error de la app, o algo más. Nunca asumas que el error es del servidor sin ver la captura primero.

ESCENARIO H — El usuario envía una captura de pantalla de un error:
Analiza lo que muestra la imagen:
- Si muestra "usuario o contraseña incorrectos": confirmar que los está escribiendo exactamente como se enviaron, sin espacios extra ni caracteres modificados.
- Si muestra "no hay conexión" o error de red: es un problema de internet del usuario, no de las credenciales.
- Si muestra la app cerrada o bloqueada: pedir que desinstale y reinstale la app.
- Si muestra un error desconocido o código de error: usar [ESCALAR: error desconocido en pantalla de login, usuario + captura disponible].
- Si muestra la pantalla de login con campos vacíos: el usuario aún no ha intentado ingresar, guiarlo paso a paso.

ESCENARIO I — El usuario pide una película, serie o canal que no encuentra o que no está disponible:
El usuario puede preguntar por contenido específico que no aparece en la plataforma o que no puede encontrar.
Cómo responder:
- Si el usuario YA mencionó el nombre del contenido en su mensaje, NO lo vuelvas a preguntar. Pasa directamente a informarle que vas a consultarlo con soporte técnico.
- Si el usuario NO mencionó el nombre, pídele amablemente el nombre exacto antes de responder.
- Una vez que tengas el nombre, infórmale de forma cordial que vas a consultarlo con el equipo de soporte técnico para verificar si puede ser agregado o si ya está disponible bajo otro nombre. No prometas que se agregará, solo que se revisará.
- Si es un cliente activo con suscripción: trátalo con prioridad, agradece que lo reporte y dile que su solicitud queda registrada para el equipo.
- Si NO es cliente activo (es un prospecto): atiéndelo igual de bien, pero aprovecha para mencionar de forma natural que el servicio cuenta con más de 11,500 canales, 55,000 películas y 15,000 series, y que con una suscripción tendrá acceso a todo ese catálogo. Invítalo a explorar el servicio.
- Mantén siempre un tono positivo y hazle saber que su solicitud es importante.

PASOS DE SOLUCIÓN ESTÁNDAR (aplícalos en este orden según el caso):
0. ANTES de dar pasos, pregunta qué aplicación está usando para ver el servicio, ya que los clientes pueden usar distintas apps de reproductor IPTV. No asumas que es una app específica. Una vez que lo diga, los pasos de reinicio y reinstalación aplican a esa app en particular.
1. Cerrar completamente la app que está usando y volver a abrirla.
2. Reiniciar el dispositivo.
3. Verificar velocidad de internet en speedtest.net (mínimo 25 Mbps recomendado).
4. Reiniciar el router si está en WiFi (desenchufar 30 segundos).
5. Probar en otro dispositivo para aislar si es el dispositivo o el contenido.
6. Desinstalar y reinstalar la app si el problema persiste en un dispositivo específico.
7. Si nada funciona después de todos los pasos anteriores: usa [ESCALAR: descripción del problema] para que un agente humano tome el caso.

TONO:
- Nunca culpes al internet del usuario sin haber descartado otras causas primero.
- Si el problema es en contenido específico y el resto funciona, reconócelo directamente.
- Sé empático: el usuario estaba disfrutando algo y se interrumpió, eso frustra.
- Haz las preguntas de una en una, con naturalidad, como lo haría un agente humano.
- Si el problema ya se resolvió, no lo analices más: confirma la cuenta, discúlpate y cierra amablemente.
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
