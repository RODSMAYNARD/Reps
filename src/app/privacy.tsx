import { ScrollView, View } from 'react-native';
import { Text } from '../components/Text';
import { Header, Screen } from '../components/ui';
import { SUPPORT_EMAIL } from '../lib/constants';
import { getLang } from '../lib/i18n';
import { colors } from '../lib/theme';

/** Política de privacidade dentro do app (vale enquanto não houver página publicada em `PRIVACY_URL`). Fonte: `docs/legal/privacy-policy.md`.
 * Rota pública (fora dos grupos protegidos): abre também no cadastro e no onboarding. */
type Doc = { updated: string; intro: string; sections: { title: string; body: string[] }[] };

const EN: Doc = {
  updated: 'Last updated: November 9, 2026',
  intro: `This policy explains what information Reps collects, why, who it is shared with and the choices you have. Reps is developed by Rodrigo Maynard, who is responsible for your data. Contact: ${SUPPORT_EMAIL}.`,
  sections: [
    { title: 'Information you give us', body: [
      'Account: your email and password, used to create and secure your account and to send account emails (welcome, password reset code, account deletion). Passwords are stored hashed by our authentication provider; we never see them.',
      'Profile: username, name, bio, link, sex, birth year, body weight, units and theme. Sex, birth year and weight are optional and are used for features such as strength levels.',
      'Training data: workouts, sets, weights, reps, times, distances, notes, routines, exercises you create and your Trainer settings, including injuries you choose to enter, which are only used to avoid exercises in your plan.',
      'Body measurements and progress photos. Photos are kept in private storage that only your account can access.',
      'Messages you send us (feedback, feature requests, reports).',
    ] },
    { title: 'Information collected automatically', body: [
      'Product analytics (PostHog): screens you open and actions such as starting or finishing a workout, linked to a random account ID, not to your email.',
      'Crash reports (Sentry): technical details when the app fails (device model, system and app version, error trace), linked to the same random ID.',
      'Subscriptions (RevenueCat): subscription status and purchase receipts from the App Store or Google Play. We never receive your card details.',
      'On your device: the workout in progress, preferences, a copy of your data for offline use and workouts waiting to upload.',
      'We do not sell your personal information and we do not use it for third-party advertising.',
    ] },
    { title: 'Who we share it with', body: [
      'Only with the providers that run the app, which process data on our behalf: Supabase (database, login and storage, São Paulo region), PostHog (analytics), Sentry (crash reports), RevenueCat (subscriptions), Resend (account emails) and Apple or Google (distribution, payments and notifications). Some of them are in the United States, so your data may be processed outside your country under the safeguards these providers offer.',
      'We may also disclose information when required by law.',
    ] },
    { title: 'How long we keep it', body: [
      'We keep your data while your account exists. When you delete your account, your profile, workouts, routines, measurements, notes and progress photos are deleted. Analytics and crash records stay with those providers under their retention settings and are not linked to your email.',
    ] },
    { title: 'Your choices and rights', body: [
      'Edit your data at any time in the app, export it in Settings > Export Data and delete your account in Settings > Delete Account (permanent).',
      'Reminders are optional and can be turned off in Settings > Reminders or in your phone settings.',
      `Depending on where you live (for example the EU, the UK, Brazil or California) you may have the right to access, correct, delete or port your data and to object to its use. Write to ${SUPPORT_EMAIL} and we will answer.`,
    ] },
    { title: 'Children', body: ['Reps is not meant for children under 13 (16 in the EU). If you believe a child created an account, contact us and we will delete it.'] },
    { title: 'Security', body: ['Data travels over encrypted connections, each account can only read its own data and progress photos are opened through temporary links. Please use a strong, unique password.'] },
    { title: 'Changes', body: ['We will update this page when our practices change and show the new date at the top.'] },
  ],
};

const PT: Doc = {
  updated: 'Última atualização: 9 de novembro de 2026',
  intro: `Esta política explica quais informações o Reps coleta, por quê, com quem são compartilhadas e quais são as suas escolhas. O Reps é desenvolvido por Rodrigo Maynard, responsável pelos seus dados. Contato: ${SUPPORT_EMAIL}.`,
  sections: [
    { title: 'Informações que você nos dá', body: [
      'Conta: e-mail e senha, usados para criar e proteger a conta e enviar e-mails da conta (boas-vindas, código para trocar a senha, exclusão da conta). As senhas ficam guardadas com criptografia pelo nosso provedor de login; nós nunca as vemos.',
      'Perfil: nome de usuário, nome, bio, link, sexo, ano de nascimento, peso, unidades e tema. Sexo, ano de nascimento e peso são opcionais e servem para recursos como o nível de força.',
      'Dados de treino: treinos, séries, pesos, repetições, tempos, distâncias, notas, rotinas, exercícios que você cria e os ajustes do Trainer, incluindo lesões que você escolher informar, usadas só para evitar exercícios no seu plano.',
      'Medidas do corpo e fotos de progresso. As fotos ficam num armazenamento privado que só a sua conta acessa.',
      'Mensagens que você nos envia (sugestões, pedidos de recurso, denúncias).',
    ] },
    { title: 'Informações coletadas automaticamente', body: [
      'Análise de uso (PostHog): telas abertas e ações como começar ou terminar um treino, ligadas a um identificador aleatório da conta, não ao seu e-mail.',
      'Relatórios de erro (Sentry): detalhes técnicos quando o app falha (modelo do aparelho, versão do sistema e do app, rastro do erro), ligados ao mesmo identificador.',
      'Assinaturas (RevenueCat): situação da assinatura e recibos de compra da App Store ou do Google Play. Nunca recebemos os dados do seu cartão.',
      'No seu aparelho: o treino em andamento, preferências, uma cópia dos seus dados para uso sem internet e treinos esperando envio.',
      'Não vendemos suas informações pessoais e não as usamos para publicidade de terceiros.',
    ] },
    { title: 'Com quem compartilhamos', body: [
      'Só com os provedores que fazem o app funcionar e tratam os dados em nosso nome: Supabase (banco de dados, login e arquivos, região de São Paulo), PostHog (análise de uso), Sentry (erros), RevenueCat (assinaturas), Resend (e-mails da conta) e Apple ou Google (distribuição, pagamentos e notificações). Alguns ficam nos Estados Unidos, então seus dados podem ser tratados fora do seu país, com as garantias que esses provedores oferecem.',
      'Também podemos divulgar informações quando a lei exigir.',
    ] },
    { title: 'Por quanto tempo guardamos', body: [
      'Guardamos seus dados enquanto a conta existir. Ao apagar a conta, seu perfil, treinos, rotinas, medidas, notas e fotos de progresso são apagados. Registros de uso e de erro ficam com esses provedores conforme a política de retenção deles e não são ligados ao seu e-mail.',
    ] },
    { title: 'Suas escolhas e direitos', body: [
      'Edite seus dados quando quiser no app, exporte em Ajustes > Exportar dados e apague a conta em Ajustes > Apagar conta (definitivo).',
      'Os lembretes são opcionais e podem ser desligados em Ajustes > Lembretes ou nos ajustes do celular.',
      `Pela LGPD e por leis de outros lugares, você pode pedir acesso, correção, exclusão ou portabilidade dos seus dados e se opor ao uso deles. Escreva para ${SUPPORT_EMAIL} e responderemos.`,
    ] },
    { title: 'Crianças', body: ['O Reps não é para menores de 13 anos (16 na União Europeia). Se uma criança criou uma conta, fale conosco e nós a apagaremos.'] },
    { title: 'Segurança', body: ['Os dados trafegam por conexões criptografadas, cada conta só lê os próprios dados e as fotos de progresso abrem por links temporários. Use uma senha forte e só sua.'] },
    { title: 'Mudanças', body: ['Atualizaremos esta página quando nossas práticas mudarem, com a nova data no topo.'] },
  ],
};

export default function Privacy() {
  const doc = getLang() === 'pt' ? PT : EN;
  return (
    <Screen>
      <Header title="Privacy Policy" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }} testID="privacy-policy">
        <Text style={{ color: colors.muted }}>{doc.updated}</Text>
        <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{doc.intro}</Text>
        {doc.sections.map((s) => (
          <View key={s.title} style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 6 }}>{s.title}</Text>
            {s.body.map((p, i) => <Text key={i} style={{ color: colors.text, fontSize: 15, lineHeight: 22 }}>{p}</Text>)}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
