/**
 * Politica de privacidad. Ruta publica (fuera de los layouts con auth): Meta la
 * exige para publicar la app, y sin app publicada los webhooks de WhatsApp no
 * entregan mensajes de produccion.
 *
 * El texto lo revisa y aprueba Juan — esto es un borrador de trabajo, no
 * asesoria legal.
 */

const ACTUALIZADO = '10 de agosto de 2026';
const CONTACTO = 'hola@personallay.com';

export function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-12">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Política de privacidad
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Personallay · Actualizada el {ACTUALIZADO}
        </p>
      </header>

      <div className="flex flex-col gap-10">
        <Section title="Quiénes somos">
          <p>
            Personallay es un servicio que automatiza el seguimiento de rutinas de entrenamiento
            por WhatsApp. Un entrenador diseña el plan y nuestro asistente lo acompaña día a día
            con cada cliente.
          </p>
          <p>
            Para consultas sobre tus datos escribinos a{' '}
            <a className="text-primary underline" href={`mailto:${CONTACTO}`}>
              {CONTACTO}
            </a>
            .
          </p>
        </Section>

        <Section title="Qué datos tratamos">
          <List
            items={[
              'Tu nombre y tu número de teléfono, que nos entrega el entrenador que te dio de alta.',
              'Los mensajes que intercambiás con el asistente por WhatsApp.',
              'Tu registro de entrenamiento: ejercicios completados, series, repeticiones, cargas y las observaciones que nos compartas.',
              'Tus preferencias de horario y zona horaria, para saber a qué hora escribirte.',
            ]}
          />
          <p>
            No pedimos ni almacenamos datos de salud clínicos, documentos de identidad ni
            información de pago de los clientes finales.
          </p>
        </Section>

        <Section title="Para qué los usamos">
          <p>
            Únicamente para prestar el servicio: enviarte la rutina del día, registrar tu avance y
            que tu entrenador pueda hacerle seguimiento. No usamos tus datos para publicidad ni
            los vendemos a terceros.
          </p>
        </Section>

        <Section title="Con quién los compartimos">
          <List
            items={[
              'Con el entrenador que te dio de alta, que es quien diseña y supervisa tu plan.',
              'Con Meta Platforms, como proveedor del canal de WhatsApp por el que se envían y reciben los mensajes.',
              'Con nuestros proveedores de infraestructura, que alojan la base de datos y el servidor bajo acuerdos de confidencialidad.',
            ]}
          />
        </Section>

        <Section title="Cuánto tiempo los conservamos">
          <p>
            Conservamos tu historial mientras seas cliente activo de un entrenador en la
            plataforma. Si pedís la baja, eliminamos tus datos personales dentro de los 30 días
            siguientes, salvo que la ley exija conservarlos por más tiempo.
          </p>
        </Section>

        <Section title="Tus derechos">
          <p>
            Podés pedirnos en cualquier momento acceder a tus datos, corregirlos, actualizarlos o
            eliminarlos, y revocar tu autorización. En Colombia estos derechos están amparados por
            la Ley 1581 de 2012 y sus normas reglamentarias.
          </p>
          <p>
            Escribinos a{' '}
            <a className="text-primary underline" href={`mailto:${CONTACTO}`}>
              {CONTACTO}
            </a>{' '}
            y respondemos dentro de los 15 días hábiles.
          </p>
        </Section>

        <Section title="Cómo dejar de recibir mensajes">
          <p>
            Respondé <strong>BAJA</strong> a cualquier mensaje del asistente y dejamos de
            escribirte de inmediato. También podés pedírselo directamente a tu entrenador. Darte de
            baja de los mensajes no borra tu historial: para eso, pedinos la eliminación por
            correo.
          </p>
        </Section>

        <Section title="Cambios en esta política">
          <p>
            Si cambiamos esta política actualizamos la fecha del encabezado. Si el cambio afecta de
            forma significativa cómo tratamos tus datos, te avisamos por WhatsApp antes de
            aplicarlo.
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-semibold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
