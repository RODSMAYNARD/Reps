import { ScrollView, View } from 'react-native';
import { Text } from '../components/Text';
import { Header, Screen } from '../components/ui';
import { SUPPORT_EMAIL } from '../lib/constants';
import { getLang } from '../lib/i18n';
import { colors } from '../lib/theme';

/** Termos de uso dentro do app: usados fora do iOS (no iOS o link abre o EULA da Apple) enquanto não houver página publicada em `OWN_TERMS_URL`. Fonte: `docs/legal/terms-of-use.md`
 * (os itens `[TODO]` do rascunho que dependem de decisão do Rodrigo, como lei aplicável, ficaram de fora). Rota pública: abre também no cadastro. */
type Doc = { updated: string; intro: string; sections: { title: string; body: string[] }[] };

const EN: Doc = {
  updated: 'Last updated: November 9, 2026',
  intro: 'These Terms are an agreement between you and Rodrigo Maynard ("Reps", "we") for the use of the Reps mobile app. By creating an account or using the app you accept them. If you do not agree, do not use the app.',
  sections: [
    { title: '1. The service', body: ['Reps lets you log workouts, build routines, follow a generated training plan (Trainer), track measurements and see statistics. Some features need an internet connection; workouts saved offline upload when you reconnect.'] },
    { title: '2. Health disclaimer', body: ['Reps is a logging and planning tool, not medical advice. Training plans, exercise suggestions, warm-up and plate calculators are generic and may not suit your health condition. Consult a doctor before starting or changing an exercise program, especially if you have injuries, heart conditions, are pregnant, or have any medical concern. Stop exercising if you feel pain, dizziness or shortness of breath. You exercise at your own risk.'] },
    { title: '3. Your account', body: ['You must be at least 13 years old (16 in the EU) and give accurate information. You are responsible for keeping your password safe and for activity in your account. Tell us right away if you suspect unauthorized access.'] },
    { title: '4. Reps Pro subscriptions', body: [
      'Some features require a paid subscription ("Reps Pro"), billed through the Apple App Store or Google Play at the price shown before purchase.',
      'Subscriptions renew automatically at the end of each period unless cancelled at least 24 hours before renewal. You can manage or cancel in your App Store or Google Play account settings; deleting the app does not cancel the subscription.',
      'Free trials, when offered, convert to a paid subscription at the end of the trial unless cancelled before it ends.',
      'Refunds are handled by Apple or Google under their policies, without prejudice to the rights consumer law gives you where you live.',
      'Prices and included features may change; changes apply from the next billing period and we will notify you in advance.',
    ] },
    { title: '5. Your content', body: ['You keep ownership of the data and content you add (workouts, notes, photos, custom exercises). You give us a limited license to store, process and display it only to operate the service for you. You can export or delete it at any time (Settings > Export Data / Delete Account).'] },
    { title: '6. Acceptable use', body: ["Do not: break the law using the app; try to access other users' data or our systems without permission; reverse engineer, scrape or overload the service; upload content that is illegal, infringing or harmful; or resell the service."] },
    { title: '7. Intellectual property', body: ['The app, its design, text, sounds and code belong to Reps or its licensors. Exercise descriptions are based on an open dataset licensed under MIT. Icons: Hugeicons (MIT); body diagram: react-native-body-highlighter (MIT).'] },
    { title: '8. Availability and changes', body: ['We work to keep Reps available but do not guarantee it will be uninterrupted or error-free. We may add, change or remove features. We may suspend or close accounts that break these Terms.'] },
    { title: '9. Limitation of liability', body: ['To the maximum extent permitted by law, the app is provided "as is", and Reps is not liable for indirect or consequential damages, loss of data, or injuries resulting from exercise. Our total liability is limited to the amount you paid us in the 12 months before the claim. Nothing here limits rights that cannot be limited under the consumer law of your country.'] },
    { title: '10. Termination', body: ['You can stop using Reps and delete your account at any time. These Terms continue to apply to past use.'] },
    { title: '11. Contact', body: [SUPPORT_EMAIL] },
  ],
};

const PT: Doc = {
  updated: 'Última atualização: 9 de novembro de 2026',
  intro: 'Estes Termos são um acordo entre você e Rodrigo Maynard ("Reps", "nós") para o uso do app Reps. Ao criar uma conta ou usar o app, você os aceita. Se não concordar, não use o app.',
  sections: [
    { title: '1. O serviço', body: ['O Reps permite registrar treinos, montar rotinas, seguir um plano de treino gerado (Trainer), acompanhar medidas e ver estatísticas. Alguns recursos precisam de internet; treinos salvos sem conexão sobem quando você voltar a ficar on-line.'] },
    { title: '2. Aviso de saúde', body: ['O Reps é uma ferramenta de registro e planejamento, não um aconselhamento médico. Planos de treino, sugestões de exercícios e as calculadoras de aquecimento e de anilhas são genéricos e podem não servir para a sua condição de saúde. Consulte um médico antes de começar ou mudar um programa de exercícios, principalmente se tiver lesões, problemas cardíacos, estiver grávida ou tiver qualquer preocupação médica. Pare de se exercitar se sentir dor, tontura ou falta de ar. Você se exercita por sua conta e risco.'] },
    { title: '3. Sua conta', body: ['Você precisa ter pelo menos 13 anos (16 na União Europeia) e informar dados verdadeiros. Você é responsável por manter sua senha segura e pelas atividades na sua conta. Avise-nos imediatamente se suspeitar de acesso não autorizado.'] },
    { title: '4. Assinaturas do Reps Pro', body: [
      'Alguns recursos exigem uma assinatura paga ("Reps Pro"), cobrada pela App Store da Apple ou pelo Google Play, pelo preço mostrado antes da compra.',
      'As assinaturas são renovadas automaticamente no fim de cada período, a menos que sejam canceladas pelo menos 24 horas antes da renovação. Você pode gerenciar ou cancelar nas configurações da sua conta da App Store ou do Google Play; apagar o app não cancela a assinatura.',
      'Testes grátis, quando oferecidos, viram assinatura paga no fim do teste, a menos que sejam cancelados antes.',
      'Reembolsos são tratados pela Apple ou pelo Google conforme as políticas deles, sem prejuízo dos direitos que a lei do consumidor do seu país lhe garante.',
      'Preços e recursos incluídos podem mudar; as mudanças valem a partir do próximo período de cobrança e avisaremos com antecedência.',
    ] },
    { title: '5. Seu conteúdo', body: ['Você continua dono dos dados e do conteúdo que adiciona (treinos, notas, fotos, exercícios criados). Você nos dá uma licença limitada para guardar, processar e exibir esse conteúdo apenas para operar o serviço para você. Você pode exportar ou apagar tudo a qualquer momento (Ajustes > Exportar dados / Apagar conta).'] },
    { title: '6. Uso aceitável', body: ['Não: use o app para descumprir a lei; tente acessar dados de outros usuários ou nossos sistemas sem permissão; faça engenharia reversa, extração automática de dados ou sobrecarga do serviço; envie conteúdo ilegal, que viole direitos ou que seja prejudicial; nem revenda o serviço.'] },
    { title: '7. Propriedade intelectual', body: ['O app, seu design, textos, sons e código pertencem ao Reps ou a seus licenciadores. As descrições dos exercícios são baseadas num conjunto de dados aberto sob licença MIT. Ícones: Hugeicons (MIT); boneco de músculos: react-native-body-highlighter (MIT).'] },
    { title: '8. Disponibilidade e mudanças', body: ['Trabalhamos para manter o Reps disponível, mas não garantimos que ele funcione sem interrupções ou erros. Podemos adicionar, mudar ou remover recursos. Podemos suspender ou encerrar contas que descumpram estes Termos.'] },
    { title: '9. Limitação de responsabilidade', body: ['Na máxima extensão permitida por lei, o app é fornecido "no estado em que se encontra", e o Reps não responde por danos indiretos, perda de dados ou lesões decorrentes de exercícios. Nossa responsabilidade total fica limitada ao valor que você nos pagou nos 12 meses anteriores à reclamação. Nada aqui limita direitos que não podem ser limitados pela lei do consumidor do seu país.'] },
    { title: '10. Encerramento', body: ['Você pode parar de usar o Reps e apagar sua conta a qualquer momento. Estes Termos continuam valendo para o uso anterior.'] },
    { title: '11. Contato', body: [SUPPORT_EMAIL] },
  ],
};

export default function Terms() {
  const doc = getLang() === 'pt' ? PT : EN;
  return (
    <Screen>
      <Header title="Terms of Use" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }} testID="terms-of-use">
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
