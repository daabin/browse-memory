/**
 * Centralised, locale-aware AI prompts used by the RAG, summary and
 * query-rewriter services.  Each locale maps to a set of plain-text
 * templates that the LLM receives as system / user content.
 *
 * Adding a new locale only requires adding an entry here — no service
 * changes needed.
 */

export interface AiPrompts {
  /** RAG system instruction */
  ragSystem: string;
  /** Template for the RAG user message (uses `{context}` and `{question}` placeholders) */
  ragUser: string;
  /** Offline-mode prefix shown when the AI API is unavailable */
  offlinePrefix: string;
  /** Summary system instruction */
  summarySystem: string;
  /** Template for the summary user message (uses `{title}` and `{content}` placeholders) */
  summaryUser: string;
  /** Query-rewriter system instruction */
  rewriteSystem: string;
  /** Example appended to the rewrite prompt to illustrate the expected format */
  rewriteExample: string;
  /** Template for the rewriter user message (uses `{history}`, `{question}` placeholders) */
  rewriteUser: string;
}

const PROMPTS: Record<string, AiPrompts> = {
  en: {
    ragSystem:
      "You are the BrowseMemory assistant. Answer only based on the provided browsing records. Use [1], [2] format to cite sources; clearly state when no relevant evidence is available.",
    ragUser: "Browsing records:\n{context}\n\nQuestion: {question}",
    offlinePrefix: "Currently in offline mode. Here are the locally retrieved records:",
    summarySystem:
      "Summarise the core content of the following web page in no more than 100 words. Output only the summary text, without any prefix or explanation.",
    summaryUser: "Title: {title}\n\nContent: {content}",
    rewriteSystem:
      "You are a query rewriting assistant. Based on the conversation history, rewrite the user's latest question into an independent, complete query that can be used directly for search. If the question is already clear enough, output the original question. Output only the rewritten query, without any explanation.",
    rewriteExample:
      'For example: the history discussed RAG architecture, and the user asked "what are its advantages?" → rewrite as "what are the advantages of RAG architecture?"',
    rewriteUser:
      "Conversation history:\n{history}\n\nUser's latest question: {question}\n\nRewritten independent query:",
  },

  zh_CN: {
    ragSystem:
      "你是 BrowseMemory 助手。只能根据提供的浏览记录回答。使用 [1]、[2] 格式标注来源；没有依据时明确说明。",
    ragUser: "浏览记录：\n{context}\n\n问题：{question}",
    offlinePrefix: "当前为离线模式。以下是本地检索到的相关记录：",
    summarySystem:
      "请用不超过 100 个字概括以下网页的核心内容。只输出摘要文本，不要添加前缀或解释。",
    summaryUser: "标题：{title}\n\n内容：{content}",
    rewriteSystem:
      "你是一个查询改写助手。根据对话历史，将用户的最新问题改写为一个独立的、完整的查询，使其可以直接用于搜索。如果问题已经足够明确，直接输出原始问题。只输出改写后的查询，不要添加任何解释。",
    rewriteExample:
      "例如：历史讨论了 RAG 架构，用户问「它的优点是什么？」→ 改写为「RAG 架构的优点是什么？」",
    rewriteUser:
      "对话历史：\n{history}\n\n用户最新问题：{question}\n\n改写后的独立查询：",
  },

  ja: {
    ragSystem:
      "あなたは BrowseMemory アシスタントです。提供されたブラウジング記録に基づいてのみ回答してください。[1]、[2] の形式で出典を示し、根拠がない場合は明確に伝えてください。",
    ragUser: "ブラウジング記録：\n{context}\n\n質問：{question}",
    offlinePrefix: "現在オフラインモードです。ローカルで取得された関連記録は以下の通りです：",
    summarySystem:
      "以下のウェブページの核心内容を100文字以内で要約してください。要約テキストのみを出力し、前置きや説明は追加しないでください。",
    summaryUser: "タイトル：{title}\n\n内容：{content}",
    rewriteSystem:
      "あなたはクエリリライトアシスタントです。会話履歴に基づいて、ユーザーの最新質問を独立した完全なクエリにリライトし、検索に直接使えるようにしてください。質問がすでに明確な場合は元の質問をそのまま出力してください。リライト後のクエリのみを出力し、説明は追加しないでください。",
    rewriteExample:
      "例：履歴で RAG アーキテクチャが議論され、ユーザーが「その利点は？」と質問 → 「RAG アーキテクチャの利点は何ですか？」にリライト",
    rewriteUser:
      "会話履歴：\n{history}\n\nユーザーの最新質問：{question}\n\nリライト後の独立クエリ：",
  },

  ko: {
    ragSystem:
      "당신은 BrowseMemory 어시스턴트입니다. 제공된 브라우징 기록에 기반해서만 답변하세요. [1], [2] 형식으로 출처를 표시하고, 근거가 없을 경우 명확히 알려주세요.",
    ragUser: "브라우징 기록:\n{context}\n\n질문: {question}",
    offlinePrefix: "현재 오프라인 모드입니다. 로컬에서 검색된 관련 기록은 다음과 같습니다:",
    summarySystem:
      "다음 웹 페이지의 핵심 내용을 100자 이내로 요약하세요. 요약 텍스트만 출력하고, 접두사나 설명을 추가하지 마세요.",
    summaryUser: "제목: {title}\n\n내용: {content}",
    rewriteSystem:
      "당신은 쿼리 재작성 어시스턴트입니다. 대화 기록을 바탕으로 사용자의 최신 질문을 독립적이고 완전한 쿼리로 재작성하여 검색에 직접 사용할 수 있도록 하세요. 질문이 이미 충분히 명확하면 원래 질문을 그대로 출력하세요. 재작성된 쿼리만 출력하고 설명을 추가하지 마세요.",
    rewriteExample:
      '예: 기록에서 RAG 아키텍처가 논의되었고, 사용자가 "장점이 뭐야?"라고 물음 → "RAG 아키텍처의 장점은 무엇입니까?"로 재작성',
    rewriteUser:
      "대화 기록:\n{history}\n\n사용자 최신 질문: {question}\n\n재작성된 독립 쿼리:",
  },

  es: {
    ragSystem:
      "Eres el asistente de BrowseMemory. Responde solo basándote en los registros de navegación proporcionados. Usa el formato [1], [2] para citar fuentes; indica claramente cuando no hay evidencia relevante.",
    ragUser: "Registros de navegación:\n{context}\n\nPregunta: {question}",
    offlinePrefix: "Actualmente en modo sin conexión. Estos son los registros recuperados localmente:",
    summarySystem:
      "Resume el contenido principal de la siguiente página web en no más de 100 palabras. Solo emite el texto del resumen, sin prefijos ni explicaciones.",
    summaryUser: "Título: {title}\n\nContenido: {content}",
    rewriteSystem:
      "Eres un asistente de reescritura de consultas. Basándote en el historial de conversación, reescribe la última pregunta del usuario en una consulta independiente y completa que pueda usarse directamente para buscar. Si la pregunta ya es suficientemente clara, emite la pregunta original. Solo emite la consulta reescrita, sin explicaciones.",
    rewriteExample:
      'Por ejemplo: el historial trató sobre la arquitectura RAG y el usuario preguntó "¿cuáles son sus ventajas?" → reescribir como "¿cuáles son las ventajas de la arquitectura RAG?"',
    rewriteUser:
      "Historial de conversación:\n{history}\n\nÚltima pregunta del usuario: {question}\n\nConsulta independiente reescrita:",
  },

  fr: {
    ragSystem:
      "Vous êtes l'assistant BrowseMemory. Répondez uniquement en vous basant sur les enregistrements de navigation fournis. Utilisez le format [1], [2] pour citer les sources ; indiquez clairement lorsqu'aucune preuve pertinente n'est disponible.",
    ragUser: "Enregistrements de navigation :\n{context}\n\nQuestion : {question}",
    offlinePrefix: "Mode hors ligne. Voici les enregistrements récupérés localement :",
    summarySystem:
      "Résumez le contenu principal de la page web suivante en 100 mots maximum. N'émettez que le texte du résumé, sans préfixe ni explication.",
    summaryUser: "Titre : {title}\n\nContenu : {content}",
    rewriteSystem:
      "Vous êtes un assistant de réécriture de requêtes. En vous basant sur l'historique de conversation, réécrivez la dernière question de l'utilisateur en une requête indépendante et complète qui peut être utilisée directement pour la recherche. Si la question est déjà suffisamment claire, émettez la question originale. N'émettez que la requête réécrite, sans explication.",
    rewriteExample:
      'Par exemple : l\'historique a abordé l\'architecture RAG et l\'utilisateur a demandé "quels sont ses avantages ?" → réécrire en "quels sont les avantages de l\'architecture RAG ?"',
    rewriteUser:
      "Historique de conversation :\n{history}\n\nDernière question de l'utilisateur : {question}\n\nRequête indépendante réécrite :",
  },

  de: {
    ragSystem:
      "Du bist der BrowseMemory-Assistent. Antworte nur auf Grundlage der bereitgestellten Browserverläufe. Verwende das Format [1], [2] zur Quellenangabe; gib klar an, wenn keine relevanten Belege vorhanden sind.",
    ragUser: "Browserverläufe:\n{context}\n\nFrage: {question}",
    offlinePrefix: "Derzeit im Offline-Modus. Hier sind die lokal abgerufenen relevanten Einträge:",
    summarySystem:
      "Fasse den Kerninhalt der folgenden Webseite in höchstens 100 Wörtern zusammen. Gib nur den Zusammenfassungstext aus, ohne Präfix oder Erklärung.",
    summaryUser: "Titel: {title}\n\nInhalt: {content}",
    rewriteSystem:
      "Du bist ein Query-Rewriting-Assistent. Basierend auf dem Gesprächsverlauf schreibe die neueste Frage des Nutzers in eine unabhängige, vollständige Abfrage um, die direkt für die Suche verwendet werden kann. Wenn die Frage bereits ausreichend klar ist, gib die ursprüngliche Frage aus. Gib nur die umgeschriebene Abfrage aus, ohne Erklärungen.",
    rewriteExample:
      'Beispiel: Im Verlauf wurde die RAG-Architektur besprochen und der Nutzer fragte "was sind ihre Vorteile?" → umschreiben als "Was sind die Vorteile der RAG-Architektur?"',
    rewriteUser:
      "Gesprächsverlauf:\n{history}\n\nNeueste Frage des Nutzers: {question}\n\nUmgeschriebene unabhängige Abfrage:",
  },

  pt: {
    ragSystem:
      "Você é o assistente BrowseMemory. Responda apenas com base nos registros de navegação fornecidos. Use o formato [1], [2] para citar fontes; indique claramente quando não houver evidência relevante.",
    ragUser: "Registros de navegação:\n{context}\n\nPergunta: {question}",
    offlinePrefix: "Atualmente no modo offline. Aqui estão os registros recuperados localmente:",
    summarySystem:
      "Resuma o conteúdo principal da seguinte página da web em no máximo 100 palavras. Emite apenas o texto do resumo, sem prefixo ou explicação.",
    summaryUser: "Título: {title}\n\nConteúdo: {content}",
    rewriteSystem:
      "Você é um assistente de reescrita de consultas. Com base no histórico da conversa, reescreva a última pergunta do usuário em uma consulta independente e completa que possa ser usada diretamente para pesquisa. Se a pergunta já for suficientemente clara, emita a pergunta original. Emite apenas a consulta reescrita, sem explicações.",
    rewriteExample:
      'Por exemplo: o histórico abordou a arquitetura RAG e o usuário perguntou "quais são suas vantagens?" → reescrever como "quais são as vantagens da arquitetura RAG?"',
    rewriteUser:
      "Histórico da conversa:\n{history}\n\nÚltima pergunta do usuário: {question}\n\nConsulta independente reescrita:",
  },

  ru: {
    ragSystem:
      "Вы — ассистент BrowseMemory. Отвечайте только на основе предоставленных записей браузинга. Используйте формат [1], [2] для указания источников; чётко сообщайте, если релевантных данных нет.",
    ragUser: "Записи браузинга:\n{context}\n\nВопрос: {question}",
    offlinePrefix: "Сейчас офлайн-режим. Вот записи, найденные локально:",
    summarySystem:
      "Кратко изложите основное содержание следующей веб-страницы не более чем в 100 словах. Выводите только текст резюме, без префиксов и пояснений.",
    summaryUser: "Заголовок: {title}\n\nСодержание: {content}",
    rewriteSystem:
      "Вы — ассистент для переформулирования запросов. На основе истории диалога переформулируйте последний вопрос пользователя в независимый, полный запрос, который можно напрямую использовать для поиска. Если вопрос уже достаточно ясен, выведите исходный вопрос. Выводите только переформулированный запрос без пояснений.",
    rewriteExample:
      'Например: в истории обсуждалась архитектура RAG, и пользователь спросил "каковы её преимущества?" → переформулировать как "Каковы преимущества архитектуры RAG?"',
    rewriteUser:
      "История диалога:\n{history}\n\nПоследний вопрос пользователя: {question}\n\nПереформулированный независимый запрос:",
  },

  ar: {
    ragSystem:
      "أنت مساعد BrowseMemory. أجب فقط بناءً على سجلات التصفح المقدمة. استخدم التنسيق [1]، [2] للإشارة إلى المصادر؛ ووضّح بوضوح عند عدم توفر أدلة ذات صلة.",
    ragUser: "سجلات التصفح:\n{context}\n\nالسؤال: {question}",
    offlinePrefix: "أنت حاليًا في وضع عدم الاتصال. إليك السجلات التي تم استرجاعها محليًا:",
    summarySystem:
      "لخّص المحتوى الأساسي لصفحة الويب التالية في ما لا يزيد عن 100 كلمة. أخرج نص الملخص فقط دون بادئة أو شرح.",
    summaryUser: "العنوان: {title}\n\nالمحتوى: {content}",
    rewriteSystem:
      "أنت مساعد لإعادة صياغة الاستعلامات. بناءً على سجل المحادثة، أعد صياغة سؤال المستخدم الأخير إلى استعلام مستقل وكامل يمكن استخدامه مباشرةً في البحث. إذا كان السؤال واضحًا بدرجة كافية، أخرج السؤال الأصلي. أخرج الاستعلام المعاد صياغته فقط دون أي شرح.",
    rewriteExample:
      'على سبيل المثال: ناقش السجل بنية RAG، وسأل المستخدم "ما مميزاتها؟" → أعد الصياغة إلى "ما مميزات بنية RAG؟"',
    rewriteUser:
      "سجل المحادثة:\n{history}\n\nآخر سؤال للمستخدم: {question}\n\nالاستعلام المستقل المعاد صياغته:",
  },
};

const DEFAULT_LOCALE = "zh_CN";

/**
 * Return the prompt set for the given locale, falling back to zh_CN
 * when the locale is not explicitly mapped.
 */
export function getPrompts(locale?: string): AiPrompts {
  return PROMPTS[locale ?? DEFAULT_LOCALE] ?? PROMPTS[DEFAULT_LOCALE];
}
