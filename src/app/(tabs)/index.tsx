import { Redirect } from 'expo-router';

// A aba Social saiu da v1 (volta na v2: código em social.tsx). O endereço "/" abre a H2, que é a tela inicial.
export default function Index() {
  return <Redirect href="/h2" />;
}
