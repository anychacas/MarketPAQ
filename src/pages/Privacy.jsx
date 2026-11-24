import React from 'react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white py-16 px-4">
      <div className="max-w-3xl mx-auto prose prose-slate">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Aviso de Privacidad</h1>
        <p className="text-sm text-slate-500 mb-8">Última actualización: marzo 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-3">Responsable del tratamiento de datos</h2>
          <p className="text-slate-600 leading-relaxed">
            <strong>FIX-IT Computación</strong> (en adelante "MarketPaq"), con domicilio en Tijuana, Baja California, México,
            es responsable del uso y protección de sus datos personales conforme a lo establecido en la
            Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)
            y su Reglamento.
          </p>
          <p className="text-slate-600 leading-relaxed mt-3">
            Contacto del responsable:{' '}
            <a href="mailto:privacidad@marketpaq.com" className="text-blue-600 hover:underline">
              privacidad@marketpaq.com
            </a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-3">Datos personales que recabamos</h2>
          <p className="text-slate-600 leading-relaxed mb-2">
            Con motivo de su registro y uso de la plataforma MarketPaq, podemos recabar los siguientes datos:
          </p>
          <ul className="list-disc list-inside text-slate-600 space-y-1">
            <li>Nombre completo</li>
            <li>Dirección de correo electrónico</li>
            <li>Número de WhatsApp / teléfono</li>
            <li>Nombre de empresa u organización</li>
            <li>Sitio web o página de Facebook</li>
            <li>Fotografía de perfil (avatar)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-3">Finalidades del tratamiento</h2>
          <p className="text-slate-600 leading-relaxed mb-2">
            Sus datos se utilizan para las siguientes finalidades <strong>primarias</strong>:
          </p>
          <ul className="list-disc list-inside text-slate-600 space-y-1">
            <li>Crear y gestionar su cuenta en MarketPaq</li>
            <li>Conectar desarrolladores de add-ons con Partners y Partners Líderes</li>
            <li>Publicar y administrar add-ons en el catálogo</li>
            <li>Enviar notificaciones transaccionales relacionadas con su cuenta</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mt-4 mb-2">
            Finalidades <strong>secundarias</strong> (puede oponerse):
          </p>
          <ul className="list-disc list-inside text-slate-600 space-y-1">
            <li>Envío de boletines informativos sobre novedades del catálogo y la plataforma</li>
            <li>Análisis estadísticos de uso de la plataforma</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mt-3">
            Para oponerse al tratamiento de datos para finalidades secundarias, envíe un correo a{' '}
            <a href="mailto:privacidad@marketpaq.com" className="text-blue-600 hover:underline">
              privacidad@marketpaq.com
            </a>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-3">Transferencia de datos</h2>
          <p className="text-slate-600 leading-relaxed">
            Sus datos personales no serán transferidos a terceros, salvo en los siguientes casos previstos
            por la LFPDPPP o necesarios para la operación del servicio:
          </p>
          <ul className="list-disc list-inside text-slate-600 space-y-1 mt-2">
            <li>
              Proveedores de infraestructura tecnológica contratados para alojar y operar la plataforma,
              bajo acuerdos de confidencialidad.
            </li>
            <li>
              Autoridades competentes cuando así lo exija la ley.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-3">Derechos ARCO</h2>
          <p className="text-slate-600 leading-relaxed">
            Usted tiene derecho a <strong>Acceder, Rectificar, Cancelar u Oponerse</strong> (derechos ARCO)
            al tratamiento de sus datos personales. Para ejercer estos derechos, envíe una solicitud a:
          </p>
          <p className="text-slate-600 mt-3">
            <a href="mailto:privacidad@marketpaq.com" className="text-blue-600 hover:underline font-medium">
              privacidad@marketpaq.com
            </a>
          </p>
          <p className="text-slate-600 leading-relaxed mt-3">
            Su solicitud deberá incluir: nombre completo, correo electrónico registrado, descripción
            del derecho que desea ejercer y copia de identificación oficial. Responderemos en un plazo
            máximo de 20 días hábiles.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-3">Cookies y tecnologías de rastreo</h2>
          <p className="text-slate-600 leading-relaxed">
            MarketPaq puede utilizar cookies de sesión necesarias para el funcionamiento de la plataforma.
            No utilizamos cookies de rastreo publicitario de terceros. Puede configurar su navegador
            para rechazar cookies, aunque esto puede afectar el funcionamiento del servicio.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-3">Cambios al aviso de privacidad</h2>
          <p className="text-slate-600 leading-relaxed">
            Nos reservamos el derecho de actualizar el presente aviso. Cualquier modificación será
            publicada en esta página con la fecha de actualización correspondiente. Le recomendamos
            revisarlo periódicamente.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-3">Autoridad competente</h2>
          <p className="text-slate-600 leading-relaxed">
            Si considera que su derecho a la protección de datos personales ha sido vulnerado, puede
            acudir al Instituto Nacional de Transparencia, Acceso a la Información y Protección de
            Datos Personales (INAI): <a href="https://www.inai.org.mx" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">www.inai.org.mx</a>.
          </p>
        </section>
      </div>
    </div>
  );
}
