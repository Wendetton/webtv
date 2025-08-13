/* ======= pages/_app.js — Next.js Custom App =======
   Importa CSS global (styles.css) para todas as páginas.
   Corrige o erro: "Global CSS cannot be imported from files other than your Custom <App>"
*/

import '../styles.css';

export default function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
