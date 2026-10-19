// utils/acentos.js — sugere a acentuação de nomes brasileiros que vêm sem acento do prontuário.
// Ordem de prioridade para cada palavra:
//   1) correções aprendidas no Admin (coleção "nameAccents" no Firestore)
//   2) dicionário de nomes e sobrenomes abaixo
//   3) regras de terminação do português (-ão, -ção, -ões, -ícia, -ônio, -ário...)
// Palavras que já vêm com acento nunca são alteradas.

// Chave: palavra sem acento (maiúsculas). Valor: forma correta (maiúsculas).
const DICIONARIO_LISTA = `
ABRAÃO ADÃO ÁGATA ÁGUEDA ALAÍDE ALCÂNTARA ALÍCIA ÁLVARES ÁLVARO AMÁLIA AMÂNCIO AMÉLIA AMÉRICO ANÁLIA
ANASTÁCIO ANDRÉ ANDRÉA ANDRÉIA ANÉSIO ÂNGELA ANGÉLICA ANÍSIO ANTÔNIA ANTÔNIO ANUNCIAÇÃO APOLINÁRIO
ARAGÃO ARAÚJO ASSUMPÇÃO ASSUNÇÃO ÁTILA ÁUREA AURÉLIO ÁVILA BÁRBARA BASTIÃO BELÉM BELTRÃO BENÍCIO
BRAGANÇA BRANDÃO BRÁS BRASÍLIO BRÁULIO BRÁZ CÂMARA CÂNDIDA CÂNDIDO CÁSSIA CÁSSIO CECÍLIA CÉLIA CÉLIO
CÉSAR CÍCERO CÍNTIA CIRÍACO CLÁUDIA CLÁUDIO CLÉA CLÓVIS CONCEIÇÃO CONSTÂNCIO CORRÊA CRESCÊNCIO
CRISTÓVÃO CUSTÓDIO DÁLIA DAMÁSIO DAMIÃO DÁRIO DÉBORA DÉCIO DÉLIA DEOCLÉCIO DIÓGENES DIONÍSIO DÓRIA
DOROTÉIA ÉDER ÉLCIO ÉLIDA ÉLIO ELISÂNGELA ELOÁ EMÍLIA EMÍLIO ENCARNAÇÃO ENÉIAS ÊNIO ÉRICA ÉRICO ÉRIKA
ESPÍRITO ESTÁCIO ESTEVÃO ESTÊVÃO EUGÊNIA EUGÊNIO EULÁLIA FABÍOLA FÁBIO FABRÍCIO FALCÃO FÁTIMA FELÍCIA
FELÍCIO FÉLIX FERNÃO FLÁVIA FLÁVIO FLORÊNCIO FRANÇA GALVÃO GENÉSIO GEÓRGIA GÉSSICA GLÁUCIA GLÁUCIO
GLÓRIA GODÓI GÓES GÓIS GONÇALVES GRAÇA GRAÇAS GREGÓRIO GUIMARÃES GUSMÃO HÉLIO HÉRCULES HERMÍNIA HILÁRIO
HIPÓLITO HONÓRIO HORÁCIO HORTÊNCIA INÁCIA INÁCIO INÊS INOCÊNCIO ÍRIS ISAÍAS ÍSIS ÍTALO JANAÍNA JÉSSICA
JOÃO JORDÃO JOSÉ JOSÉLIA JOSÉLIO JOSUÉ JÚLIA JÚLIO JÚNIOR KAUÃ KAUÊ LAÉRCIO LAÍS LÁZARA LÁZARO LEÃO
LEÔNIDAS LETÍCIA LÍDIA LÍGIA LÍRIO LÍVIA LOBÃO LOURENÇO LÚCIA LUCÍDIO LÚCIO LUÍS LUÍSA MAGALHÃES MAÍRA
MAÍSA MARÇAL MÁRCIA MÁRCIO MARIÂNGELA MARÍLIA MARINÊS MÁRIO MAURÍCIO MÁXIMO MELÃO MENDONÇA MÉRCIA
MILITÃO MOISÉS MÔNICA NÁDIA NATÁLIA NATHÁLIA NAZARÉ NÉLIA NÉLIO NÓBREGA NOÉ NOÊMIA NÚBIA OCTÁVIO OFÉLIA
OLÍVIA OSÓRIO OTACÍLIO OTÁVIA OTÁVIO OTÍLIA PÁDUA PAIXÃO PÂMELA PATRÍCIA PATRÍCIO PEÇANHA PERPÉTUO
PLÁCIDO PLÍNIO PRAÇA PRUDÊNCIO QUEIRÓS RAÍ RAÍSSA RAMÃO RÉGIS RENÊ ROGÉRIO ROMÃO ROMÁRIO RÔMULO ROSÁLIA
ROSÂNGELA ROSÁRIO RÚBIA SALOMÃO SÁVIO SEBASTIÃO SÉRGIO SERRÃO SÍLVIA SÍLVIO SILVÉRIO SIMÃO SIMÕES SÔNIA
TAINÁ TAÍS TÂNIA TÁVORA TEÓFILO TERÊNCIO TÉRCIO THAÍS TOMÁS TOMÉ TRISTÃO TÚLIO ÚRSULA VALADÃO VALÊNCIO
VALÉRIA VALÉRIO VÂNIA VENÂNCIO VERÔNICA VINÍCIUS VIRGÍNIA VITÓRIA VITÓRIO ZÉLIA ZILÁ
`;

// Formas que parecem precisar de acento pelas regras, mas não levam
const SEM_ACENTO = new Set([
  'PAES', 'PAIS', 'LUIZ', 'VITOR', 'VICTOR', 'MARIA', 'ROSA', 'SOFIA', 'NELSON', 'GERSON', 'EDSON',
  'ELSON', 'WILSON', 'ANDERSON', 'EMERSON', 'JEFERSON', 'JEFFERSON', 'DA', 'DE', 'DO', 'DAS', 'DOS', 'E',
  'QUEIROZ', 'GODOY', 'ALICE', 'PAULO', 'MARCOS', 'LUCAS', 'MATEUS', 'TIAGO', 'THIAGO', 'JULIANA',
  'LUCIANA', 'LUCIANO', 'CAIO', 'MAURO', 'CLARA', 'LAURA', 'DIEGO', 'NOEMI', 'RAQUEL',
]);

const DICIONARIO = {};
for (const certo of DICIONARIO_LISTA.split(/\s+/).filter(Boolean)) {
  DICIONARIO[semAcento(certo)] = certo;
}

// Regras de terminação (aplicadas só a palavras com 4+ letras, sem acento e fora do dicionário)
const REGRAS = [
  [/CAO$/, 'ÇÃO'], [/COES$/, 'ÇÕES'],
  [/AO$/, 'ÃO'], [/AES$/, 'ÃES'], [/OES$/, 'ÕES'],
  [/ICIA$/, 'ÍCIA'], [/ICIO$/, 'ÍCIO'],
  [/ACIO$/, 'ÁCIO'], [/ACIA$/, 'ÁCIA'],
  [/UCIA$/, 'ÚCIA'], [/UCIO$/, 'ÚCIO'],
  [/ONIO$/, 'ÔNIO'], [/ONIA$/, 'ÔNIA'], [/ONICA$/, 'ÔNICA'],
  [/ENCIO$/, 'ÊNCIO'], [/ENCIA$/, 'ÊNCIA'],
  [/ARIO$/, 'ÁRIO'],
  [/ERIO$/, 'ÉRIO'], [/ERIA$/, 'ÉRIA'], [/ERGIO$/, 'ÉRGIO'],
  [/ORIO$/, 'ÓRIO'], [/ORIA$/, 'ÓRIA'],
  [/ODIO$/, 'ÓDIO'],
  [/ILIA$/, 'ÍLIA'], [/ILIO$/, 'ÍLIO'],
  [/ULIA$/, 'ÚLIA'], [/ULIO$/, 'ÚLIO'],
  [/IDIA$/, 'ÍDIA'], [/IVIA$/, 'ÍVIA'],
  [/AUDIA$/, 'ÁUDIA'], [/AUDIO$/, 'ÁUDIO'],
  [/AVIA$/, 'ÁVIA'], [/AVIO$/, 'ÁVIO'],
  [/ABIO$/, 'ÁBIO'],
  [/ARCIA$/, 'ÁRCIA'], [/ARCIO$/, 'ÁRCIO'],
  [/ASIO$/, 'ÁSIO'], [/ESIO$/, 'ÉSIO'], [/ISIO$/, 'ÍSIO'],
  [/ERICA$/, 'ÉRICA'], [/ERICO$/, 'ÉRICO'],
  [/ANGELA$/, 'ÂNGELA'],
];

export function semAcento(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function temAcento(s) {
  return semAcento(s) !== s;
}

// Copia maiúsculas/minúsculas da palavra original (as duas têm o mesmo número de letras)
function manterCaixa(original, corrigida) {
  let out = '';
  for (let i = 0; i < corrigida.length; i++) {
    const o = original[i] || '';
    const c = corrigida[i];
    out += o && o === o.toLowerCase() && o !== o.toUpperCase() ? c.toLowerCase() : c;
  }
  return out;
}

function corrigirPalavra(palavra, aprendidas) {
  if (!palavra || temAcento(palavra) || !/^[A-Za-zÇç]+$/.test(semAcento(palavra))) return palavra;
  const chave = semAcento(palavra).toUpperCase();
  let certo = (aprendidas && aprendidas[chave]) || DICIONARIO[chave];
  if (!certo && !SEM_ACENTO.has(chave) && chave.length >= 4) {
    for (const [re, fim] of REGRAS) {
      if (re.test(chave)) { certo = chave.replace(re, fim); break; }
    }
  }
  if (!certo || certo.length !== palavra.length) return palavra;
  return manterCaixa(palavra, certo);
}

// Retorna { texto, mudou, partes:[{ texto, mudou }] } — partes inclui os espaços
export function sugerirAcentos(nome, aprendidas) {
  const partes = String(nome || '').split(/(\s+)/).map((p) => {
    if (!p || /^\s+$/.test(p)) return { texto: p, mudou: false };
    const c = corrigirPalavra(p, aprendidas);
    return { texto: c, mudou: c !== p };
  });
  const texto = partes.map(p => p.texto).join('');
  return { texto, mudou: partes.some(p => p.mudou), partes };
}

// Palavras com acento digitadas à mão, para o Admin "aprender": { SEM_ACENTO: COM_ACENTO }
export function palavrasAcentuadas(nome) {
  const out = {};
  for (const p of String(nome || '').split(/\s+/)) {
    if (p && temAcento(p) && /^[A-Za-zÀ-ÿ]+$/.test(p)) out[semAcento(p).toUpperCase()] = p.toUpperCase();
  }
  return out;
}
