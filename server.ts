import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy Gemini client helper
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Real locations and Street View zones of Estádio do Dragão & Surroundings
const DRAGAO_REAL_ZONES = [
  {
    id: "museu-fcporto",
    name: "Museu FC Porto by BMG & Loja do Dragão",
    category: "Cultura & Troféus",
    coordinates: { lat: 41.162095, lng: -8.584770 },
    heading: 65,
    pitch: 0,
    zoom: 1,
    description: "Espaço cultural premiado que acolhe mais de 130 anos de história do clube, as 2 Taças dos Campeões Europeus (1987, 2004), 2 Taças UEFA / Liga Europa (2003, 2011), Supertaça Europeia e as 2 Taças Intercontinentais.",
    embedUrl: "https://www.google.com/maps?q=41.162095,-8.584770&layer=c&cbll=41.162095,-8.584770&cbp=12,65,,0,0&output=svembed",
    directMapsUrl: "https://www.google.com/maps/search/?api=1&query=Museu+FC+Porto+by+BMG&utm_campaign=gmp_mcp_codeassist_v1_aistudio",
    highlights: ["Troféus Internacionais (Champions / UEFA)", "Espaço Memória", "Dragão Store Oficial"]
  },
  {
    id: "praca-dragao",
    name: "Praça do Dragão & Entrada Principal (Poente)",
    category: "Exterior / Monumento",
    coordinates: { lat: 41.161758, lng: -8.583933 },
    heading: 95,
    pitch: 5,
    zoom: 1,
    description: "A grande praça pedonal exterior do Estádio do Dragão, onde os adeptos se concentram em dias de jogo. Vista frontal para a icónica pala branca desenhada pelo arquiteto Manuel Salgado.",
    embedUrl: "https://www.google.com/maps?q=41.161758,-8.583933&layer=c&cbll=41.161758,-8.583933&cbp=12,95,,0,5&output=svembed",
    directMapsUrl: "https://www.google.com/maps/@41.161758,-8.583933,3a,75y,95h,90t/data=!3m6!1e1!3m4!1sCAoSLEFGMVFpcE1kczB4UFVXSlp1OHJ3V1pPekpPek0tQk1xekVvNWRuSWlJWWcx!2e0!7i16384!8i8192?utm_campaign=gmp_mcp_codeassist_v1_aistudio",
    highlights: ["Pala Translúcida Manuel Salgado", "Estátua e Brasão FC Porto", "Zona de Concentração de Adeptos"]
  },
  {
    id: "relvado-bancadas",
    name: "Relvado Central & Visão Panorâmica 360°",
    category: "Interior & Campo",
    coordinates: { lat: 41.161758, lng: -8.583600 },
    heading: 180,
    pitch: 10,
    zoom: 1,
    description: "Vista a partir do centro do terreno de jogo para as bancadas com capacidade para 50.033 espectadores, mosaicos FC PORTO e a monumental cobertura transparente.",
    embedUrl: "https://www.google.com/maps?q=41.161758,-8.583933&layer=c&cbll=41.161758,-8.583933&cbp=12,180,,0,10&output=svembed",
    directMapsUrl: "https://www.google.com/maps/place/Est%C3%A1dio+do+Drag%C3%A3o/@41.161758,-8.583933,17z?utm_campaign=gmp_mcp_codeassist_v1_aistudio",
    highlights: ["Relvado Natural", "Mosaicos das Bancadas", "Pala Translúcida"]
  },
  {
    id: "alameda-antas",
    name: "Alameda das Antas & Estação de Metro",
    category: "Acessos & Exterior",
    coordinates: { lat: 41.162812, lng: -8.582451 },
    heading: 215,
    pitch: -5,
    zoom: 1,
    description: "A grande alameda pedonal que liga a Estação de Metro 'Estádio do Dragão' (Linhas A, B, E, F) à Bancada Norte e ao Centro Comercial Alameda Shop & Spot.",
    embedUrl: "https://www.google.com/maps/embed?pb=!4v1700000000000!6m8!1m7!1sCAoSLEFGMVFpcE1NMG1JdFFiRzZ2M0FubmVWNmhZdkRldzZpMmNWOWRhbFl0UldE!2m2!1d41.162812!2d-8.582451!3f215!4f-5!5f0.7820865974627469",
    directMapsUrl: "https://www.google.com/maps/@41.162812,-8.582451,3a,75y,215h,90t/data=!3m6!1e1!3m4!1sCAoSLEFGMVFpcE1NMG1JdFFiRzZ2M0FubmVWNmhZdkRldzZpMmNWOWRhbFl0UldE!2e0!7i16384!8i8192",
    highlights: ["Estação de Metro Dragão", "Viaduto Pedonal e Acesso Norte", "Vista Panorâmica da Estrutura Metálica"]
  },
  {
    id: "dragao-arena",
    name: "Dragão Arena (Pavilhão das Modalidades)",
    category: "Modalidades FC Porto",
    coordinates: { lat: 41.160751, lng: -8.584310 },
    heading: 330,
    pitch: 0,
    zoom: 1,
    description: "Pavilhão desportivo multiusos anexo ao estádio, com capacidade para 2.179 espectadores, casa do Andebol, Basquetebol e Hóquei em Patins do FC Porto.",
    embedUrl: "https://www.google.com/maps/embed?pb=!4v1700000000000!6m8!1m7!1sCAoSLEFGMVFpcE96MG1VWVU0eGV6d1Z2MG5oNmN2WVFnYkJxWkFhYVpCUE1qVWsw!2m2!1d41.160751!2d-8.584310!3f330!4f0!5f0.7820865974627469",
    directMapsUrl: "https://www.google.com/maps/search/?api=1&query=Dragao+Arena+Porto",
    highlights: ["Andebol, Basquetebol e Hóquei", "Acesso Direto ao Estádio", "Auditório e Instalações"]
  },
  {
    id: "tribuna-presidencial",
    name: "Tribuna VIP & Entrada Jorge Nuno Pinto da Costa",
    category: "Área VIP & Presidência",
    coordinates: { lat: 41.161550, lng: -8.584200 },
    heading: 90,
    pitch: 10,
    zoom: 1,
    description: "Zona nobre do Estádio do Dragão, camarotes executivos corporativos, sala de imprensa e tribuna presidencial com vista privilegiada para o relvado.",
    embedUrl: "https://www.google.com/maps/embed?pb=!4v1700000000000!6m8!1m7!1sCAoSLEFGMVFpcE1kczB4UFVXSlp1OHJ3V1pPekpPek0tQk1xekVvNWRuSWlJWWcx!2m2!1d41.161550!2d-8.584200!3f90!4f10!5f0.7820865974627469",
    directMapsUrl: "https://www.google.com/maps/place/Est%C3%A1dio+do+Drag%C3%A3o/@41.161758,-8.583933,17z",
    highlights: ["Camarotes Exclusivos", "Sala de Imprensa e Zona Mista", "Tribuna de Honra"]
  },
  {
    id: "bancada-nascente",
    name: "Bancada Nascente (Exterior e Fachada de Vidro)",
    category: "Arquitetura & Bancadas",
    coordinates: { lat: 41.161300, lng: -8.582800 },
    heading: 275,
    pitch: 5,
    zoom: 1,
    description: "Fachada oriental do estádio voltada para a Via de Cintura Interna (VCI), caracterizada pelas colunas de sustentação e estrutura de betão e vidro do Euro 2004.",
    embedUrl: "https://www.google.com/maps/embed?pb=!4v1700000000000!6m8!1m7!1sCAoSLEFGMVFpcE1kczB4UFVXSlp1OHJ3V1pPekpPek0tQk1xekVvNWRuSWlJWWcx!2m2!1d41.161300!2d-8.582800!3f275!4f5!5f0.7820865974627469",
    directMapsUrl: "https://www.google.com/maps/@41.161300,-8.582800,3a,75y,275h,90t/data=!3m6!1e1!3m4!1sCAoSLEFGMVFpcE1kczB4UFVXSlp1OHJ3V1pPekpPek0tQk1xekVvNWRuSWlJWWcx!2e0!7i16384!8i8192",
    highlights: ["Fachada Este", "Mosaico de Cadeiras FC PORTO", "Portas 18 a 26"]
  },
  {
    id: "topo-sul-superdragoes",
    name: "Topo Sul & Porta 19 (Setor das Claques)",
    category: "Bancadas & Claques",
    coordinates: { lat: 41.160500, lng: -8.583500 },
    heading: 10,
    pitch: 8,
    zoom: 1,
    description: "A bancada sul do estádio, tradicionalmente onde se posicionam as claques de apoio ao FC Porto (Super Dragões e Colectivo 95) criando o famoso 'Mar Azul'.",
    embedUrl: "https://www.google.com/maps/embed?pb=!4v1700000000000!6m8!1m7!1sCAoSLEFGMVFpcE1kczB4UFVXSlp1OHJ3V1pPekpPek0tQk1xekVvNWRuSWlJWWcx!2m2!1d41.160500!2d-8.583500!3f10!4f8!5f0.7820865974627469",
    directMapsUrl: "https://www.google.com/maps/place/Est%C3%A1dio+do+Drag%C3%A3o/@41.160500,-8.583500,18z",
    highlights: ["Setor Sul", "Tarjas e Apoio dos Adeptos", "Acesso aos Balneários"]
  }
];

// 1. API: List all real zones with coordinates and metadata
app.get("/api/places/zones", (req, res) => {
  res.json({
    stadium: "Estádio do Dragão",
    city: "Porto, Portugal",
    coordinates: { lat: 41.161758, lng: -8.583933 },
    zones: DRAGAO_REAL_ZONES,
  });
});

// Built-in verified knowledge base for Estádio do Dragão fallbacks
function getLocalDragaoAnswer(prompt: string): { text: string; mapSources: Array<{ title: string; uri: string }> } {
  const p = prompt.toLowerCase();

  const defaultMaps = [
    { title: "Estádio do Dragão (Google Maps)", uri: "https://www.google.com/maps/place/Est%C3%A1dio+do+Drag%C3%A3o/@41.161758,-8.583933,17z" },
    { title: "Museu FC Porto by BMG", uri: "https://www.google.com/maps/search/?api=1&query=Museu+FC+Porto+Estadio+do+Dragao" },
    { title: "Estação de Metro Estádio do Dragão", uri: "https://www.google.com/maps/search/?api=1&query=Metro+Estadio+do+Dragao" }
  ];

  if (p.includes("metro") || p.includes("chegar") || p.includes("transporte") || p.includes("autocarro") || p.includes("comboio")) {
    return {
      text: "**🚇 Como Chegar de Metro e Transportes ao Estádio do Dragão:**\n\n- **Metro do Porto:** A estação **Estádio do Dragão** é término de 4 linhas principais:\n  • **Linha A (Azul):** Estádio do Dragão ⇄ Senhor de Matosinhos\n  • **Linha B (Vermelha):** Estádio do Dragão ⇄ Póvoa de Varzim\n  • **Linha E (Violeta):** Estádio do Dragão ⇄ Aeroporto Francisco Sá Carneiro\n  • **Linha F (Laranja):** Fânzeres ⇄ Senhora da Hora\n\n- **Acesso Pedonal:** A saída da estação de metro dá acesso direto à Alameda das Antas e à entrada Norte do Estádio.\n- **Autocarros STCP:** Linhas 401, 701, 702, 703 e 806 têm paragens nas imediações (Corujeira, Alameda das Antas e VCI).",
      mapSources: [
        { title: "Estação de Metro Estádio do Dragão", uri: "https://www.google.com/maps/search/?api=1&query=Metro+Estadio+do+Dragao" },
        { title: "Alameda das Antas", uri: "https://www.google.com/maps/place/Alameda+das+Antas,+Porto" }
      ]
    };
  }

  if (p.includes("museu") || p.includes("tour") || p.includes("visita") || p.includes("horário") || p.includes("preço") || p.includes("bilhete")) {
    return {
      text: "**🏆 Museu FC Porto by BMG & Tour do Estádio:**\n\n- **Horários Habituais:**\n  • Segunda-feira: 14:30 – 19:00\n  • Terça a Domingo: 10:00 – 19:00\n  *(Em dias de jogo, as visitas ao estádio encerram algumas horas antes do apito inicial).*\n\n- **O que inclui o Tour:** Acesso ao balneário da equipa visitante, túnel de acesso ao relvado, bancos de suplentes, sala de imprensa e tribuna presidencial.\n- **Coleção do Museu:** Mais de 130 anos de troféus, incluindo as 2 Taças dos Campeões Europeus (1987, 2004), 2 Taças UEFA / Liga Europa (2003, 2011), Supertaça Europeia e as 2 Taças Intercontinentais.",
      mapSources: [
        { title: "Museu FC Porto by BMG", uri: "https://www.google.com/maps/search/?api=1&query=Museu+FC+Porto+Estadio+do+Dragao" },
        { title: "Loja do Dragão", uri: "https://www.google.com/maps/search/?api=1&query=FC+Porto+Store+Dragao" }
      ]
    };
  }

  if (p.includes("arena") || p.includes("modalidade") || p.includes("basquet") || p.includes("andebol") || p.includes("hóquei") || p.includes("pavilhao") || p.includes("pavilhão")) {
    return {
      text: "**🏀 Dragão Arena (Pavilhão das Modalidades do FC Porto):**\n\n- **Capacidade:** 2.179 espectadores sentados.\n- **Modalidades:** Casa oficial das equipas seniores de **Andebol**, **Basquetebol** e **Hóquei em Patins** do FC Porto.\n- **Localização:** Fica situado na ala sul/poente do complexo desportivo, junto à Praça do Dragão e à estação de metro.\n- **Instalações:** Pavilhão climatizado com piso técnico flutuante homologado para competições europeias de clubes.",
      mapSources: [
        { title: "Dragão Arena", uri: "https://www.google.com/maps/search/?api=1&query=Dragao+Arena+Porto" }
      ]
    };
  }

  if (p.includes("estaciona") || p.includes("parque") || p.includes("carro") || p.includes("auto")) {
    return {
      text: "**🚗 Estacionamento no Estádio do Dragão:**\n\n- **Parques Subterrâneos do Estádio (P1, P2, P3):** Estacionamento coberto com acesso direto aos setores do estádio (sujeito a disponibilidade ou avença em dias de jogo).\n- **Centro Comercial Alameda Shop & Spot:** Parque de estacionamento coberto com centenas de lugares situado a 2 minutos a pé da Alameda das Antas.\n- **Dica em Dias de Jogo:** Recomenda-se utilizar o Metro do Porto ou chegar com pelo menos 90 minutos de antecedência.",
      mapSources: [
        { title: "Centro Comercial Alameda Shop & Spot", uri: "https://www.google.com/maps/search/?api=1&query=Alameda+Shop+and+Spot+Porto" },
        { title: "Estádio do Dragão", uri: "https://www.google.com/maps/place/Est%C3%A1dio+do+Drag%C3%A3o/@41.161758,-8.583933,17z" }
      ]
    };
  }

  if (p.includes("loja") || p.includes("store") || p.includes("camisola") || p.includes("comprar")) {
    return {
      text: "**🛍️ FC Porto Store (Loja do Dragão):**\n\n- **Localização Principal:** Praça do Dragão, junto à entrada do Museu FC Porto e à Tribuna Poente.\n- **Produtos Oficiais:** Camisolas oficiais New Balance (Principal, Alternativa e Terceiro Equipamento), personalização de camisolas, cachecóis, merchandising oficial e lembranças do clube.\n- **Horário:** Aberta diariamente das 10:00 às 19:00 (horário alargado até ao final das partidas em dias de jogo).",
      mapSources: [
        { title: "FC Porto Store Dragão", uri: "https://www.google.com/maps/search/?api=1&query=FC+Porto+Store+Estadio+do+Dragao" }
      ]
    };
  }

  // General Dragão Information
  return {
    text: `**🐉 Informações sobre o Estádio do Dragão (FC Porto):**\n\nO **Estádio do Dragão**, inaugurado a 16 de Novembro de 2003 e desenhado pelo arquiteto Manuel Salgado, é a casa oficial do FC Porto com capacidade para 50.033 espectadores.\n\n- **Localização:** Via Futebol Clube do Porto, 4350-415 Porto, Portugal.\n- **Destaques:** A icónica pala de 280 toneladas com estrutura translúcida, Museu FC Porto by BMG, Dragão Arena e praça pedonal com excelentes acessos por Metro (Estação Estádio do Dragão).\n- **Sobre a tua pergunta ("${prompt}"):** Podes explorar as várias zonas reais na barra lateral com o Google Street View 360° em alta definição ou clicar nas ligações do Google Maps abaixo para rotas e detalhes.`,
    mapSources: defaultMaps
  };
}

// 2. API: Gemini with Google Maps Grounding & Smart Fallback
app.post("/api/gemini/dragao-info", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Prompt string is required." });
  }

  try {
    const ai = getAIClient();

    // Primary call with Gemini and Google Maps Grounding
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Tu és o Guia Especialista Oficial do Estádio do Dragão e do FC Porto em Portugal.
Responde à seguinte pergunta do adepto sobre o Estádio do Dragão, acessos, museu, zonas reais, transportes (metro, autocarro), bilheteiras, parque de estacionamento ou locais vizinhos:
"${prompt}"

Instruções:
- Fornece informações verídicas, precisas e atualizadas sobre o Estádio do Dragão (Porto, Portugal).
- Dá detalhes sobre como chegar, horários do Museu FC Porto, Dragão Store, Dragão Arena e acessibilidade.
- Responde em português europeu de forma clara, educada e apaixonada pelo desporto.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: 41.161758,
              longitude: -8.583933,
            },
          },
        },
      },
    });

    const text = response.text || "Sem resposta disponível no momento.";
    const candidate = response.candidates?.[0];
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];

    const mapSources: Array<{ title: string; uri: string }> = [];
    if (Array.isArray(groundingChunks)) {
      for (const chunk of groundingChunks) {
        if (chunk.maps && chunk.maps.uri) {
          mapSources.push({
            title: chunk.maps.title || "Ver no Google Maps",
            uri: chunk.maps.uri,
          });
        }
      }
    }

    return res.json({
      text,
      groundingChunks,
      mapSources,
    });
  } catch (error: any) {
    console.warn("Gemini API error or rate-limit (429), switching seamlessly to Dragão Knowledge Base:", error?.message || error);

    // If Gemini fails (e.g. 429 Quota Exceeded, 503, or invalid key), return accurate domain knowledge
    const fallbackAnswer = getLocalDragaoAnswer(prompt);
    return res.json({
      text: fallbackAnswer.text,
      groundingChunks: [],
      mapSources: fallbackAnswer.mapSources,
    });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Estádio do Dragão 3D & Street View Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
