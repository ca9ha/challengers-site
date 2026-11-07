"use strict";

const $ = (id) => document.getElementById(id);

const deckOrder = {
  S: 0,
  A: 1,
  B: 2,
  C: 3,
};

let cards = [];

/**
 * Читает CSV с разделителем "," или ";".
 * Поддерживает BOM, кавычки, переносы строк внутри полей
 * и двойные кавычки, экранированные как "".
 */
function parseCSV(source) {
  const text = source.replace(/^\uFEFF/, "");

  const firstLine = text.split(/\r\n|\n|\r/, 1)[0];
  const delimiter =
    firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";

  const rows = [];

  let row = [];
  let field = "";
  let inQuotes = false;
  let quoteClosed = false;

  function finishField() {
    row.push(field);
    field = "";
    quoteClosed = false;
  }

  function finishRow() {
    finishField();

    if (row.some((value) => value.trim() !== "")) {
      rows.push(row);
    }

    row = [];
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
          quoteClosed = true;
        }
      } else {
        field += char;
      }

      continue;
    }

    if (char === delimiter) {
      finishField();
      continue;
    }

    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") {
        i++;
      }

      finishRow();
      continue;
    }

    if (quoteClosed) {
      if (char === " " || char === "\t") {
        continue;
      }

      throw new Error(
        `Запись ${rows.length + 1}: лишние символы после закрывающей кавычки.`
      );
    }

    if (char === '"') {
      if (field !== "") {
        throw new Error(
          `Запись ${rows.length + 1}: некорректные кавычки в CSV.`
        );
      }

      inQuotes = true;
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    throw new Error("В CSV не закрыты кавычки.");
  }

  if (field !== "" || row.length > 0 || quoteClosed) {
    finishRow();
  }

  if (rows.length === 0) {
    throw new Error("CSV-файл пуст.");
  }

  const headers = rows.shift().map((value) => value.trim());

  const requiredHeaders = [
    "id",
    "name",
    "deck",
    "type",
    "power",
    "description",
    "image",
  ];

  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error(`В CSV отсутствует столбец "${header}".`);
    }
  }

  if (new Set(headers).size !== headers.length) {
    throw new Error("В CSV повторяются названия столбцов.");
  }

  const usedIds = new Set();

  return rows.map((values, index) => {
    const recordNumber = index + 2;

    if (values.length !== headers.length) {
      throw new Error(
        `Запись ${recordNumber}: ожидалось ${headers.length} полей, ` +
          `получено ${values.length}. Проверьте разделители и кавычки.`
      );
    }

    const card = Object.fromEntries(
      headers.map((header, column) => [header, values[column].trim()])
    );

    if (!card.id || !card.name || !card.type || !card.image) {
      throw new Error(
        `Запись ${recordNumber}: заполните id, name, type и image.`
      );
    }

    if (usedIds.has(card.id)) {
      throw new Error(`Повторяется идентификатор карты: "${card.id}".`);
    }

    usedIds.add(card.id);

    card.deck = card.deck.toUpperCase();

    if (
      card.deck !== "" &&
      !Object.prototype.hasOwnProperty.call(deckOrder, card.deck)
    ) {
      throw new Error(
        `Карта «${card.name}»: набор должен быть S, A, B, C или пустым.`
      );
    }

    if (
      card.power !== "" &&
      (!Number.isFinite(Number(card.power)) || Number(card.power) < 0)
    ) {
      throw new Error(
        `Карта «${card.name}»: базовая сила должна быть числом от 0.`
      );
    }

    const imagePath = card.image.replace(/\\/g, "/");
    const pathParts = imagePath.split("/");

    if (
      !imagePath.startsWith("images/") ||
      pathParts.some((part) => part === ".." || part === "." || part === "") ||
      /[?#]/.test(imagePath)
    ) {
      throw new Error(
        `Карта «${card.name}»: укажите путь вида images/Название карты.png.`
      );
    }

    card.imageURL = pathParts
      .map((part) => encodeURIComponent(part))
      .join("/");

    return card;
  });
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

function getDeckRank(deck) {
  return deckOrder[deck] ?? 4;
}

function getPowerValue(power) {
  return power === "" ? Infinity : Number(power);
}

function createCardImage(card) {
  const image = document.createElement("img");

  image.alt = card.name;
  image.loading = "lazy";

  image.addEventListener(
    "error",
    () => {
      const message = createElement(
        "span",
        "tags",
        `Не найдено изображение: ${card.image}`
      );

      message.style.padding = "16px";
      message.style.overflowWrap = "anywhere";

      image.replaceWith(message);
    },
    { once: true }
  );

  image.src = card.imageURL;

  return image;
}

function openCard(card) {
  $("title").textContent = card.name;

  $("meta").textContent = [
    card.deck ? `Набор ${card.deck}` : "Набор не указан",
    card.type,
    `Базовая сила: ${card.power === "" ? "—" : card.power}`,
  ].join(" · ");

  $("description").textContent =
    card.description || "Описание пока не добавлено.";

  const picture = $("picture");

  picture.onerror = () => {
    picture.onerror = null;
    picture.removeAttribute("src");
    picture.alt = `Не удалось загрузить изображение: ${card.image}`;
  };

  picture.alt = card.name;
  picture.src = card.imageURL;

  $("modal").showModal();
}

function render() {
  const query = $("search").value.trim().toLocaleLowerCase("ru");
  const selectedDeck = $("deck").value;
  const selectedType = $("type").value;
  const sort = $("sort").value;

  const filteredCards = cards.filter((card) => {
    if (selectedDeck === "unknown" && card.deck !== "") {
      return false;
    }

    if (
      selectedDeck !== "" &&
      selectedDeck !== "unknown" &&
      card.deck !== selectedDeck
    ) {
      return false;
    }

    if (selectedType !== "" && card.type !== selectedType) {
      return false;
    }

    if (query !== "") {
      const searchableText = [
        card.name,
        card.type,
        card.description,
      ]
        .join(" ")
        .toLocaleLowerCase("ru");

      if (!searchableText.includes(query)) {
        return false;
      }
    }

    return true;
  });

  filteredCards.sort((a, b) => {
    let difference = 0;

    if (sort === "deck") {
      difference = getDeckRank(a.deck) - getDeckRank(b.deck);
    } else if (sort === "type") {
      difference = a.type.localeCompare(b.type, "ru");
    } else if (sort === "power") {
      const powerA = getPowerValue(a.power);
      const powerB = getPowerValue(b.power);

      difference = powerA === powerB ? 0 : powerA - powerB;
    }

    return difference || a.name.localeCompare(b.name, "ru");
  });

  $("status").textContent =
    `Показано ${filteredCards.length} из ${cards.length}`;

  const elements = filteredCards.map((card) => {
    const button = createElement("button", "card");
    button.type = "button";
    button.setAttribute("aria-label", `Открыть карту ${card.name}`);

    const art = createElement("div", "art");
    art.append(createCardImage(card));

    const info = createElement("div", "info");
    const title = createElement("h2", "", card.name);
    const tags = createElement("div", "tags");

    const badge = createElement(
      "span",
      "badge",
      card.deck || "?"
    );

    const power = card.power === "" ? "—" : card.power;

    tags.append(
      badge,
      document.createTextNode(`${card.type} · Сила ${power}`)
    );

    const description = createElement(
      "p",
      "excerpt",
      card.description || "Описание пока не добавлено."
    );

    info.append(title, tags, description);
    button.append(art, info);

    button.addEventListener("click", () => openCard(card));

    return button;
  });

  if (elements.length === 0) {
    elements.push(
      createElement(
        "div",
        "empty",
        cards.length === 0
          ? "В CSV пока нет карточек."
          : "Карты не найдены. Измените фильтры."
      )
    );
  }

  $("grid").replaceChildren(...elements);
}

function configureFilters() {
  const deckSelect = $("deck");

  deckSelect.replaceChildren(
    new Option("Все наборы", ""),
    new Option("S", "S"),
    new Option("A", "A"),
    new Option("B", "B"),
    new Option("C", "C"),
    new Option("Без набора", "unknown")
  );

  const types = [...new Set(cards.map((card) => card.type))].sort(
    (a, b) => a.localeCompare(b, "ru")
  );

  $("type").replaceChildren(
    new Option("Все типы", ""),
    ...types.map((type) => new Option(type, type))
  );
}

function configureEvents() {
  for (const id of ["search", "deck", "type", "sort"]) {
    $(id).addEventListener(
      id === "search" ? "input" : "change",
      render
    );
  }

  $("reset").addEventListener("click", () => {
    $("search").value = "";
    $("deck").value = "";
    $("type").value = "";
    $("sort").value = "name";

    render();
  });

  $("close").addEventListener("click", () => {
    $("modal").close();
  });

  $("modal").addEventListener("click", (event) => {
    const modal = $("modal");

    if (event.target !== modal) {
      return;
    }

    const bounds = modal.getBoundingClientRect();

    const outside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;

    if (outside) {
      modal.close();
    }
  });
}

async function loadCards() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("data/cards.csv", {
      cache: "no-cache",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Не удалось загрузить data/cards.csv: HTTP ${response.status}.`
      );
    }

    const text = await response.text();

    if (/^\s*<!doctype html|^\s*<html[\s>]/i.test(text)) {
      throw new Error(
        "Вместо CSV сервер вернул HTML. Проверьте путь data/cards.csv."
      );
    }

    return parseCSV(text);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "Загрузка CSV заняла больше 15 секунд. Проверьте соединение и повторите попытку."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function showError(error) {
  console.error("Ошибка каталога Challengers:", error);

  const message =
    error instanceof Error ? error.message : String(error);

  const status = $("status");
  const grid = $("grid");

  if (status) {
    status.textContent = `Ошибка: ${message}`;
  }

  if (grid) {
    const hint =
      location.protocol === "file:"
        ? "Откройте сайт через GitHub Pages или локальный HTTP-сервер, а не двойным щелчком по index.html."
        : "Проверьте файл data/cards.csv. Подробности ошибки доступны в консоли браузера (F12 → Console).";

    grid.replaceChildren(createElement("div", "empty", hint));
  }
}

async function init() {
  try {
    const requiredIds = [
      "search",
      "deck",
      "type",
      "sort",
      "reset",
      "status",
      "grid",
      "modal",
      "close",
      "title",
      "meta",
      "description",
      "picture",
    ];

    const missingIds = requiredIds.filter((id) => !$(id));

    if (missingIds.length > 0) {
      throw new Error(
        `В index.html отсутствуют элементы: ${missingIds.join(", ")}.`
      );
    }

    $("status").textContent = "Загрузка каталога…";

    cards = await loadCards();

    configureFilters();
    configureEvents();
    render();
  } catch (error) {
    showError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}