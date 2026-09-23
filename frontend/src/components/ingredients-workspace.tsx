"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Icon } from "./icons";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

type Category = "protein" | "vegetable" | "fruit" | "grain" | "spice" | "dairy" | "other";
type IngredientState = "raw" | "prepared" | "cooked" | "frozen";
type Storage = "fridge" | "freezer" | "pantry";

export type PantryIngredient = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  category: Category;
  state: IngredientState;
  storage: Storage;
  note: string;
  emoji: string;
  createdAt: string;
};

type IngredientForm = Omit<PantryIngredient, "id" | "createdAt">;

type IngredientsWorkspaceProps = {
  dictionary: Dictionary;
  locale: Locale;
  onAskHestia: (prompt: string) => void;
  onScanImage: (file: File) => void;
  userId: string;
};

const categories: Category[] = ["protein", "vegetable", "fruit", "grain", "spice", "dairy", "other"];
const states: IngredientState[] = ["raw", "prepared", "cooked", "frozen"];
const storages: Storage[] = ["fridge", "freezer", "pantry"];

const categoryEmoji: Record<Category, string> = {
  protein: "🍗",
  vegetable: "🥦",
  fruit: "🍎",
  grain: "🍚",
  spice: "🌿",
  dairy: "🥛",
  other: "🫙",
};

const emptyForm: IngredientForm = {
  name: "",
  quantity: "1",
  unit: "item",
  category: "vegetable",
  state: "raw",
  storage: "fridge",
  note: "",
  emoji: categoryEmoji.vegetable,
};

const quickIngredients: Array<Pick<IngredientForm, "category" | "emoji"> & { name: Record<Locale, string> }> = [
  { name: { vi: "Thịt gà", en: "Chicken" }, category: "protein", emoji: "🍗" },
  { name: { vi: "Trứng", en: "Egg" }, category: "protein", emoji: "🥚" },
  { name: { vi: "Khoai tây", en: "Potato" }, category: "vegetable", emoji: "🥔" },
  { name: { vi: "Cà chua", en: "Tomato" }, category: "vegetable", emoji: "🍅" },
  { name: { vi: "Hành tây", en: "Onion" }, category: "spice", emoji: "🧅" },
  { name: { vi: "Gạo", en: "Rice" }, category: "grain", emoji: "🍚" },
];

type IngredientProfile = {
  aliases: string[];
  compounds: string[];
  summary: { en: string; vi: string };
  safety: { en: string[]; vi: string[] };
  substitutes: { en: string[]; vi: string[] };
};

const profiles: IngredientProfile[] = [
  {
    aliases: ["chicken", "gà"],
    compounds: ["Protein", "Carnosine", "Creatine"],
    summary: {
      vi: "Nguồn protein linh hoạt, nhưng trạng thái sống cần được tách khỏi thực phẩm ăn liền và nấu chín kỹ.",
      en: "A versatile protein source; raw poultry should stay separate from ready-to-eat food and be cooked thoroughly.",
    },
    safety: {
      vi: ["Tránh rửa thịt sống làm bắn nước nhiễm khuẩn.", "Dùng thớt và dao riêng cho thực phẩm sống.", "Xác minh độ chín bằng nhiệt độ lõi thay vì chỉ nhìn màu."],
      en: ["Avoid washing raw poultry, which can spread contaminated droplets.", "Use separate boards and knives for raw food.", "Verify doneness with core temperature rather than color alone."],
    },
    substitutes: { vi: ["Đậu hũ", "Gà tây", "Nấm đùi gà"], en: ["Tofu", "Turkey", "King oyster mushroom"] },
  },
  {
    aliases: ["potato", "khoai tây"],
    compounds: ["Starch", "Asparagine", "Glycoalkaloids"],
    summary: {
      vi: "Tinh bột và asparagine khi gặp nhiệt cao, bề mặt khô có thể tham gia con đường hình thành acrylamide.",
      en: "Starch-rich potato contains asparagine; dry high-heat cooking can support acrylamide formation.",
    },
    safety: {
      vi: ["Loại bỏ phần xanh và mầm rõ rệt.", "Khi chiên/nướng, nhắm màu vàng thay vì nâu sậm.", "Ngâm/rửa phần cắt có thể giảm đường khử trên bề mặt."],
      en: ["Remove clearly green or heavily sprouted portions.", "When frying or roasting, aim for golden rather than dark brown.", "Soaking or rinsing cut surfaces can reduce surface reducing sugars."],
    },
    substitutes: { vi: ["Khoai lang", "Bí đỏ", "Súp lơ"], en: ["Sweet potato", "Pumpkin", "Cauliflower"] },
  },
  {
    aliases: ["egg", "trứng"],
    compounds: ["Ovalbumin", "Lecithin", "Choline"],
    summary: {
      vi: "Trứng tạo cấu trúc nhờ protein đông tụ và lecithin nhũ hóa, hữu ích cho sốt, bánh và món chiên.",
      en: "Eggs build structure through protein coagulation and emulsify through lecithin.",
    },
    safety: {
      vi: ["Giữ lạnh và tránh dùng vỏ nứt.", "Nhóm dễ tổn thương nên dùng trứng được nấu chín kỹ hoặc tiệt trùng."],
      en: ["Keep chilled and avoid cracked shells.", "Vulnerable groups should use thoroughly cooked or pasteurized eggs."],
    },
    substitutes: { vi: ["Đậu hũ non", "Aquafaba", "Hạt lanh xay"], en: ["Silken tofu", "Aquafaba", "Ground flaxseed"] },
  },
  {
    aliases: ["onion", "hành", "shallot"],
    compounds: ["Sulfur compounds", "Quercetin", "Fructans"],
    summary: {
      vi: "Hợp chất lưu huỳnh tạo mùi hăng; nhiệt làm dịu mùi và phát triển vị ngọt.",
      en: "Sulfur compounds drive pungency; heating softens them and develops sweetness.",
    },
    safety: {
      vi: ["Bảo quản nơi khô thoáng; phần đã cắt nên đậy kín và giữ lạnh."],
      en: ["Store whole bulbs in a dry ventilated place; cover and chill cut portions."],
    },
    substitutes: { vi: ["Hành tím", "Tỏi tây", "Hành lá"], en: ["Shallot", "Leek", "Spring onion"] },
  },
];

function profileFor(name: string) {
  const normalized = name.toLocaleLowerCase();
  const profile = profiles.find((item) => item.aliases.some((alias) => normalized.includes(alias)));
  if (profile) return profile;
  return {
    compounds: [],
    summary: {
      vi: "Hestia chưa có hồ sơ biên soạn sẵn cho nguyên liệu này. Hãy yêu cầu phân tích để tra cứu theo ngữ cảnh nấu cụ thể.",
      en: "Hestia does not have a curated profile for this ingredient yet. Ask for an analysis using your specific cooking context.",
    },
    safety: { vi: [], en: [] },
    substitutes: { vi: [], en: [] },
    aliases: [],
  } satisfies IngredientProfile;
}

function loadIngredients(storageKey: string): PantryIngredient[] {
  try {
    const value = localStorage.getItem(storageKey);
    return value ? (JSON.parse(value) as PantryIngredient[]) : [];
  } catch {
    return [];
  }
}

export function IngredientsWorkspace({
  dictionary,
  locale,
  onAskHestia,
  onScanImage,
  userId,
}: IngredientsWorkspaceProps) {
  const t = dictionary.ingredients;
  const storageKey = `hestia-pantry:${userId}`;
  const [items, setItems] = useState<PantryIngredient[]>(() => loadIngredients(storageKey));
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Category | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<IngredientForm>(emptyForm);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [labOpen, setLabOpen] = useState(false);
  const [method, setMethod] = useState("fry");
  const [temperature, setTemperature] = useState("180");
  const [duration, setDuration] = useState("15");
  const scanInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, storageKey]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const matchesCategory = filter === "all" || item.category === filter;
      const matchesQuery = !needle || `${item.name} ${item.note}`.toLocaleLowerCase().includes(needle);
      return matchesCategory && matchesQuery;
    });
  }, [filter, items, query]);

  const selectedItems = items.filter((item) => selected.includes(item.id));
  const detailItem = items.find((item) => item.id === detailId) || null;

  function openAdd(seed?: Pick<IngredientForm, "name" | "category" | "emoji">) {
    setEditingId(null);
    setForm(seed ? { ...emptyForm, ...seed } : emptyForm);
    setFormOpen(true);
  }

  function openEdit(item: PantryIngredient) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      state: item.state,
      storage: item.storage,
      note: item.note,
      emoji: item.emoji,
    });
    setFormOpen(true);
  }

  function saveIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    if (editingId) {
      setItems((current) => current.map((item) => item.id === editingId ? { ...item, ...form, name } : item));
    } else {
      setItems((current) => [{ ...form, id: crypto.randomUUID(), name, createdAt: new Date().toISOString() }, ...current]);
    }
    setFormOpen(false);
  }

  function removeIngredient(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    setSelected((current) => current.filter((item) => item !== id));
    if (detailId === id) setDetailId(null);
    setFormOpen(false);
  }

  function toggleSelected(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function namesForPrompt() {
    return selectedItems.map((item) => `${item.name} (${t.states[item.state]})`).join(", ");
  }

  function ask(kind: "recipes" | "safety" | "compare") {
    const names = namesForPrompt();
    if (!names) return;
    const prompts = {
      recipes: t.prompts.recipes.replace("{ingredients}", names),
      safety: t.prompts.safety.replace("{ingredients}", names),
      compare: t.prompts.compare.replace("{ingredients}", names),
    };
    onAskHestia(prompts[kind]);
  }

  function runLab() {
    const names = namesForPrompt();
    if (!names) return;
    const prompt = t.prompts.lab
      .replace("{ingredients}", names)
      .replace("{method}", t.methods[method as keyof typeof t.methods])
      .replace("{temperature}", temperature)
      .replace("{duration}", duration);
    onAskHestia(prompt);
  }

  function chooseScan(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onScanImage(file);
  }

  return (
    <section className="ingredients-workspace">
      <div className="ingredients-scroll">
        <header className="ingredients-hero">
          <div>
            <span className="ingredients-eyebrow">{t.eyebrow}</span>
            <h1>{t.title}</h1>
            <p>{t.description}</p>
          </div>
          <div className="ingredients-hero-actions">
            <input accept="image/*" hidden onChange={chooseScan} ref={scanInput} type="file" />
            <button className="ingredient-scan" onClick={() => scanInput.current?.click()} type="button">
              <Icon height={18} name="camera" width={18} />{t.scan}
            </button>
            <button className="ingredient-add" onClick={() => openAdd()} type="button">
              <Icon height={18} name="add" width={18} />{t.add}
            </button>
          </div>
        </header>

        <div className="ingredient-stats">
          <div><strong>{items.length}</strong><span>{t.stats.total}</span></div>
          <div><strong>{items.filter((item) => item.storage === "fridge").length}</strong><span>{t.stats.fridge}</span></div>
          <div><strong>{new Set(items.map((item) => item.category)).size}</strong><span>{t.stats.groups}</span></div>
          <div><strong>{selected.length}</strong><span>{t.stats.selected}</span></div>
        </div>

        <div className="ingredients-toolbar">
          <label className="ingredient-search">
            <span aria-hidden="true">⌕</span>
            <input onChange={(event) => setQuery(event.target.value)} placeholder={t.search} value={query} />
          </label>
          <div className="ingredient-filters" aria-label={t.filterLabel}>
            <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")} type="button">{t.all}</button>
            {categories.map((category) => (
              <button className={filter === category ? "active" : ""} key={category} onClick={() => setFilter(category)} type="button">
                {t.categories[category]}
              </button>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="ingredients-empty">
            <span className="empty-bowl">🫙</span>
            <h2>{t.emptyTitle}</h2>
            <p>{t.emptyDescription}</p>
            <div className="quick-add-list">
              {quickIngredients.map((item) => (
                <button
                  key={item.name.en}
                  onClick={() => openAdd({ ...item, name: item.name[locale] })}
                  type="button"
                >
                  <span>{item.emoji}</span>+ {item.name[locale]}
                </button>
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ingredients-no-results"><strong>{t.noResults}</strong><button onClick={() => { setQuery(""); setFilter("all"); }} type="button">{t.clearFilters}</button></div>
        ) : (
          <div className="ingredient-grid">
            {filtered.map((item) => {
              const isSelected = selected.includes(item.id);
              return (
                <article className={isSelected ? "ingredient-card selected" : "ingredient-card"} key={item.id}>
                  <button aria-label={t.select.replace("{name}", item.name)} className="ingredient-check" onClick={() => toggleSelected(item.id)} type="button">
                    {isSelected ? "✓" : ""}
                  </button>
                  <button className="ingredient-card-main" onClick={() => setDetailId(item.id)} type="button">
                    <span className={`ingredient-emoji ${item.category}`}>{item.emoji}</span>
                    <span className="ingredient-card-copy">
                      <strong>{item.name}</strong>
                      <small>{item.quantity} {t.units[item.unit as keyof typeof t.units] || item.unit}</small>
                    </span>
                    <span className="ingredient-state">{t.states[item.state]}</span>
                  </button>
                  <div className="ingredient-card-meta">
                    <span>{t.categories[item.category]}</span>
                    <span>·</span>
                    <span>{t.storages[item.storage]}</span>
                    <button onClick={() => openEdit(item)} type="button">{t.edit}</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <p className="ingredient-storage-note">{t.localStorageNote}</p>
      </div>

      {selected.length ? (
        <div className="ingredient-selection-bar">
          <span><strong>{selected.length}</strong>{t.selectionCount}</span>
          <div>
            <button onClick={() => ask("recipes")} type="button">🍳 {t.actions.recipes}</button>
            <button onClick={() => ask("safety")} type="button">🛡️ {t.actions.safety}</button>
            <button disabled={selected.length < 2} onClick={() => ask("compare")} type="button">↔ {t.actions.compare}</button>
            <button className="lab-action" onClick={() => setLabOpen(true)} type="button">⚗ {t.actions.lab}</button>
            <button aria-label={t.clearSelection} className="clear-selection" onClick={() => setSelected([])} type="button">×</button>
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <div className="ingredient-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
          <form className="ingredient-modal" onSubmit={saveIngredient}>
            <div className="ingredient-modal-heading">
              <div><span>{form.emoji}</span><div><strong>{editingId ? t.form.editTitle : t.form.addTitle}</strong><small>{t.form.description}</small></div></div>
              <button onClick={() => setFormOpen(false)} type="button">×</button>
            </div>
            <label>{t.form.name}<input autoFocus onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={t.form.namePlaceholder} required value={form.name} /></label>
            <div className="ingredient-form-row">
              <label>{t.form.quantity}<input min="0" onChange={(event) => setForm({ ...form, quantity: event.target.value })} step="0.1" type="number" value={form.quantity} /></label>
              <label>{t.form.unit}<select onChange={(event) => setForm({ ...form, unit: event.target.value })} value={form.unit}>{Object.entries(t.units).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
            </div>
            <div className="ingredient-form-row">
              <label>{t.form.category}<select onChange={(event) => { const category = event.target.value as Category; setForm({ ...form, category, emoji: categoryEmoji[category] }); }} value={form.category}>{categories.map((category) => <option key={category} value={category}>{t.categories[category]}</option>)}</select></label>
              <label>{t.form.state}<select onChange={(event) => setForm({ ...form, state: event.target.value as IngredientState })} value={form.state}>{states.map((state) => <option key={state} value={state}>{t.states[state]}</option>)}</select></label>
            </div>
            <label>{t.form.storage}<select onChange={(event) => setForm({ ...form, storage: event.target.value as Storage })} value={form.storage}>{storages.map((storage) => <option key={storage} value={storage}>{t.storages[storage]}</option>)}</select></label>
            <label>{t.form.note}<textarea onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder={t.form.notePlaceholder} rows={3} value={form.note} /></label>
            <div className="ingredient-modal-actions">
              {editingId ? <button className="ingredient-delete" onClick={() => removeIngredient(editingId)} type="button">{t.form.delete}</button> : <span />}
              <div><button onClick={() => setFormOpen(false)} type="button">{t.form.cancel}</button><button className="ingredient-save" type="submit">{t.form.save}</button></div>
            </div>
          </form>
        </div>
      ) : null}

      {detailItem ? (() => {
        const profile = profileFor(detailItem.name);
        const language = locale === "vi" ? "vi" : "en";
        return (
          <div className="ingredient-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailId(null); }}>
            <aside className="ingredient-drawer">
              <button className="drawer-close" onClick={() => setDetailId(null)} type="button">×</button>
              <div className={`drawer-hero ${detailItem.category}`}><span>{detailItem.emoji}</span><small>{t.categories[detailItem.category]}</small></div>
              <h2>{detailItem.name}</h2>
              <p>{profile.summary[language]}</p>
              <div className="drawer-facts">
                <div><small>{t.detail.amount}</small><strong>{detailItem.quantity} {t.units[detailItem.unit as keyof typeof t.units] || detailItem.unit}</strong></div>
                <div><small>{t.detail.state}</small><strong>{t.states[detailItem.state]}</strong></div>
                <div><small>{t.detail.storage}</small><strong>{t.storages[detailItem.storage]}</strong></div>
              </div>
              {profile.compounds.length ? <section><h3>{t.detail.compounds}</h3><div className="compound-tags">{profile.compounds.map((compound) => <span key={compound}>{compound}</span>)}</div></section> : null}
              {profile.safety[language].length ? <section><h3>{t.detail.safety}</h3><ul>{profile.safety[language].map((tip) => <li key={tip}>{tip}</li>)}</ul></section> : null}
              {profile.substitutes[language].length ? <section><h3>{t.detail.substitutes}</h3><div className="substitute-tags">{profile.substitutes[language].map((item) => <span key={item}>{item}</span>)}</div></section> : null}
              {detailItem.note ? <section><h3>{t.detail.note}</h3><p>{detailItem.note}</p></section> : null}
              <button className="drawer-ask" onClick={() => onAskHestia(t.prompts.detail.replace("{ingredient}", detailItem.name))} type="button">{t.detail.ask}</button>
              <small className="drawer-disclaimer">{t.detail.disclaimer}</small>
            </aside>
          </div>
        );
      })() : null}

      {labOpen ? (
        <div className="ingredient-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLabOpen(false); }}>
          <div className="ingredient-modal ingredient-lab">
            <div className="ingredient-modal-heading"><div><span>⚗️</span><div><strong>{t.lab.title}</strong><small>{t.lab.description}</small></div></div><button onClick={() => setLabOpen(false)} type="button">×</button></div>
            <div className="lab-ingredients">{selectedItems.map((item) => <span key={item.id}>{item.emoji} {item.name}</span>)}</div>
            <label>{t.lab.method}<select onChange={(event) => setMethod(event.target.value)} value={method}>{Object.entries(t.methods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <div className="ingredient-form-row">
              <label>{t.lab.temperature}<input max="300" min="0" onChange={(event) => setTemperature(event.target.value)} type="number" value={temperature} /></label>
              <label>{t.lab.duration}<input max="600" min="1" onChange={(event) => setDuration(event.target.value)} type="number" value={duration} /></label>
            </div>
            <div className="lab-preview"><span>{method === "fry" ? "🍳" : method === "boil" ? "🫕" : "🔥"}</span><i /> <strong>{temperature}°C</strong><i /> <strong>{duration} min</strong></div>
            <button className="ingredient-save lab-run" onClick={runLab} type="button">{t.lab.run}</button>
            <small className="drawer-disclaimer">{t.lab.disclaimer}</small>
          </div>
        </div>
      ) : null}
    </section>
  );
}
