"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  discoverFoodLibrary,
  getIngredientProfile,
  getMealProfile,
  searchFoodLibrary,
} from "@/lib/hestia-api";

type MealCard = { id: string; name: string; image: string; area?: string; category?: string };
type Nutrient = { label: string; value: number; unit: string };
type FoodRecord = {
  fdc_id: number;
  name: string;
  data_type: string;
  food_category?: string;
  nutrients: Record<string, Nutrient>;
  focus_nutrient?: Nutrient;
  source_url: string;
  basis: string;
  image?: string;
  image_label?: string;
  image_match_score?: number;
  image_source?: string;
};
type ChemistryFood = {
  public_id: string;
  name: string;
  scientific_name?: string;
  food_group?: string;
  food_subgroup?: string;
  relation_count?: number;
  quantified_count?: number;
};
type Compound = {
  public_id: string;
  name: string;
  annotation_quality?: string;
  superclass?: string;
  class_name?: string;
  evidence_type?: "quantified_food_relation" | "reported_food_relation" | "direct_compound_match";
  food_match_count?: number;
  food_names?: string[];
};
type SearchResult = {
  query: string;
  meals: MealCard[];
  foods: FoodRecord[];
  chemistry: { foods: ChemistryFood[]; compounds: Compound[] };
};
type IngredientProfile = {
  name: string;
  image: string;
  nutrition_matches: FoodRecord[];
  chemistry: {
    matched: Array<{
      food: { foodb_id: string; name: string; scientific_name?: string; group?: string };
      relation_count: number;
      quantified_class_coverage: Array<{ label: string; count: number }>;
      representative_quantified_records: Array<{
        public_id: string;
        name: string;
        superclass?: string;
        standard_content?: string;
        original_unit?: string;
      }>;
      representative_records?: Array<{
        public_id: string;
        name: string;
        superclass?: string;
        standard_content?: string;
        original_unit?: string;
      }>;
      record_evidence?: "quantified" | "reported";
    }>;
  };
};
type MealProfile = {
  id: string;
  name: string;
  image: string;
  area?: string;
  category?: string;
  tags: string[];
  instructions?: string;
  source_url?: string;
  video?: string;
  ingredients: Array<{ name: string; measure: string }>;
  primary_ingredient: IngredientProfile;
};

const modes = [
  ["all", "Everything"],
  ["meals", "Dishes"],
  ["foods", "Ingredients"],
  ["nutrients", "By nutrient"],
  ["chemistry", "Compounds"],
] as const;

const nutrientOptions = [
  "protein", "fiber", "energy", "fat", "carbohydrate",
  "vitamin c", "iron", "calcium", "potassium", "sodium",
];
const nutrientScale: Record<string, number> = {
  energy: 600, protein: 50, fat: 65, carbohydrate: 130, fiber: 30,
  sodium: 2300, potassium: 3500, calcium: 1000, iron: 18, "vitamin c": 90,
};

function nutrientWidth(key: string, value = 0) {
  return `${Math.min(100, Math.max(4, value / (nutrientScale[key] || 100) * 100))}%`;
}

function titleCase(value: string) {
  return value.toLocaleLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function NutrientPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  return <div className={open ? "nutrient-picker open" : "nutrient-picker"} ref={root}>
    <button aria-expanded={open} aria-haspopup="listbox" className="nutrient-picker-trigger" onClick={() => setOpen((current) => !current)} type="button">
      <span>{titleCase(value)}</span><i aria-hidden="true" />
    </button>
    {open ? <div aria-label="Nutrient to rank" className="nutrient-picker-menu" role="listbox">
      {nutrientOptions.map((item) => <button
        aria-selected={item === value}
        className={item === value ? "selected" : ""}
        key={item}
        onClick={() => { onChange(item); setOpen(false); }}
        role="option"
        type="button"
      >
        <span>{titleCase(item)}</span>{item === value ? <b aria-hidden="true">✓</b> : null}
      </button>)}
    </div> : null}
  </div>;
}

function ingredientImageUrl(name: string) {
  const cleanName = name.split(",")[0].trim().replace(/\s+/g, "_");
  return `https://www.themealdb.com/images/ingredients/${encodeURIComponent(cleanName)}.png`;
}

function IngredientArtwork({ name, src: suppliedSrc, compact = false }: { name: string; src?: string; compact?: boolean }) {
  const src = suppliedSrc || ingredientImageUrl(name);
  const [failedSrc, setFailedSrc] = useState("");
  const failed = failedSrc === src;

  return <span className={compact ? "ingredient-artwork compact" : "ingredient-artwork"}>
    {failed ? <span className="ingredient-artwork-fallback" aria-hidden="true"><i /><b>{name.slice(0, 1).toUpperCase()}</b></span> : <Image
      alt={`${name} ingredient`}
      fill
      onError={() => setFailedSrc(src)}
      sizes={compact ? "64px" : "(max-width: 620px) 100vw, 30vw"}
      src={src}
      unoptimized
    />}
  </span>;
}

function FoodNutrition({ food, focus }: { food: FoodRecord; focus?: string }) {
  const visible = Object.entries(food.nutrients)
    .filter(([key]) => [focus, "energy", "protein", "fiber", "sodium"].includes(key))
    .slice(0, 5);
  return <article className="nutrition-record">
    <div className="nutrition-record-head"><span>USDA · {food.data_type}</span><a href={food.source_url} rel="noreferrer" target="_blank">FDC {food.fdc_id} ↗</a></div>
    <div className="nutrition-artwork">
      <IngredientArtwork name={food.image_label || food.name} src={food.image} />
      <small>{food.image_source ? `${food.image_source} · ${food.image_label}` : "No exact ingredient artwork"}</small>
    </div>
    <div className="nutrition-record-body">
      <h3>{titleCase(food.name)}</h3>
      {food.focus_nutrient ? <div className="nutrient-focus"><strong>{food.focus_nutrient.value}</strong><span>{food.focus_nutrient.unit}<small>{focus}</small></span></div> : null}
      <div className="nutrient-bars">{visible.map(([key, item]) => <div key={key}><span>{key}<b>{item.value} {item.unit}</b></span><i><em style={{ width: nutrientWidth(key, item.value) }} /></i></div>)}</div>
      <small className="data-basis">{food.basis}</small>
    </div>
  </article>;
}

function SourceLegend() {
  return <div className="library-sources" aria-label="Data sources">
    <span><i className="meal-source" /> TheMealDB <small>recipes & images</small></span>
    <span><i className="usda-source" /> USDA FDC <small>nutrients</small></span>
    <span><i className="foodb-source" /> FooDB <small>food chemistry</small></span>
  </div>;
}

export function FoodLibrary() {
  const [mode, setMode] = useState<(typeof modes)[number][0]>("all");
  const [query, setQuery] = useState("");
  const [nutrient, setNutrient] = useState("protein");
  const [featured, setFeatured] = useState<MealCard[]>([]);
  const [categories, setCategories] = useState<Array<{ name: string; image: string }>>([]);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [meal, setMeal] = useState<MealProfile | null>(null);
  const [ingredient, setIngredient] = useState<IngredientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    discoverFoodLibrary().then((data) => {
      if (!active) return;
      setFeatured(data.featured || []);
      setCategories(data.categories || []);
    }).catch(() => {
      if (active) setError("The live library is taking longer than expected. Try a search in a moment.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      const initialQuery = params.get("q")?.trim() || "";
      const requestedMode = params.get("kind") || "all";
      const initialMode = modes.some(([value]) => value === requestedMode)
        ? requestedMode as (typeof modes)[number][0]
        : "all";
      const initialNutrient = params.get("nutrient") || "protein";
      if (initialQuery.length < 2) return;
      setQuery(initialQuery);
      setMode(initialMode);
      setNutrient(initialNutrient);
      setLoading(true);
      void searchFoodLibrary(
        initialQuery,
        initialMode,
        initialMode === "nutrients" ? initialNutrient : undefined,
      ).then((data) => setResults(data)).catch(() => {
        setError("No source answered this saved search. Try a broader food name.");
      }).finally(() => setLoading(false));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!meal && !ingredient && !detailLoading) return;
    const previous = document.body.style.overflow;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMeal(null);
        setIngredient(null);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  }, [detailLoading, ingredient, meal]);

  const resultCount = useMemo(() => results
    ? results.meals.length + results.foods.length
      + results.chemistry.foods.length + results.chemistry.compounds.length
    : 0, [results]);

  async function search(
    event?: FormEvent,
    searchQuery = query,
    searchMode: (typeof modes)[number][0] = mode,
  ) {
    event?.preventDefault();
    if (searchQuery.trim().length < 2) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ q: searchQuery.trim(), kind: searchMode });
    if (searchMode === "nutrients") params.set("nutrient", nutrient);
    window.history.replaceState(null, "", `/ingredients?${params}`);
    try {
      setResults(await searchFoodLibrary(
        searchQuery.trim(), searchMode, searchMode === "nutrients" ? nutrient : undefined,
      ));
      requestAnimationFrame(() => document.querySelector(".library-results")
        ?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      setError("No source answered this search. Check the connection or try a broader food name.");
    } finally {
      setLoading(false);
    }
  }

  async function openMeal(id: string) {
    setDetailLoading(true);
    setIngredient(null);
    try {
      setMeal(await getMealProfile(id));
    } catch {
      setError("This meal profile could not be assembled right now.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function inspectIngredient(name: string) {
    setDetailLoading(true);
    try {
      setIngredient(await getIngredientProfile(name));
    } catch {
      setError("Ingredient intelligence is temporarily unavailable.");
    } finally {
      setDetailLoading(false);
    }
  }

  const activeProfile = ingredient || meal?.primary_ingredient;
  const foodbMatch = activeProfile?.chemistry.matched?.[0];

  return <>
    <section className="library-hero">
      <div className="site-container library-hero-inner">
        <div className="library-intro"><span className="site-eyebrow"><i /> Food intelligence library</span><h1>Find a dish.<br /><em>Understand it.</em></h1><p>Explore recipes through the ingredients, nutrients, and compounds that shape what happens in the pan and on the plate.</p></div>
        <form className="library-search" onSubmit={(event) => void search(event)}>
          <div className="library-mode-tabs">{modes.map(([value, label]) => <button className={mode === value ? "active" : ""} key={value} onClick={() => setMode(value)} type="button">{label}</button>)}</div>
          <div className="library-query-row">
            <span aria-hidden="true">⌕</span>
            <input aria-label="Search the food library" onChange={(event) => setQuery(event.target.value)} placeholder={mode === "nutrients" ? "Try lentils, salmon, yogurt…" : "Search tomato, curry, anthocyanin…"} value={query} />
            {mode === "nutrients" ? <NutrientPicker onChange={setNutrient} value={nutrient} /> : null}
            <button disabled={loading || query.trim().length < 2} type="submit">{loading ? "Searching" : "Explore"}<b>↗</b></button>
          </div>
          <div className="search-suggestions"><span>Try</span>{["tomato", "salmon", "chickpea", "vitamin C"].map((item) => <button key={item} onClick={() => setQuery(item)} type="button">{item}</button>)}</div>
        </form>
        <SourceLegend />
      </div>
    </section>

    {error ? <div className="library-error site-container" role="status">{error}</div> : null}

    {results ? <section className="library-results site-container">
      <header className="library-section-heading"><div><span>LIVE RESULTS</span><h2>{query}</h2></div><p>{resultCount} records mapped across the available sources. Similar names can describe different food states, so source IDs stay visible.</p></header>
      {results.meals.length ? <div className="result-block"><div className="result-block-title"><h3>Dishes</h3><span>TheMealDB</span></div><div className="meal-grid">{results.meals.map((item) => <button className="meal-card" key={item.id} onClick={() => void openMeal(item.id)} type="button"><span className="meal-card-image"><Image alt="" fill sizes="(max-width: 700px) 80vw, 25vw" src={item.image} unoptimized /></span><span className="meal-card-copy"><small>{[item.area, item.category].filter(Boolean).join(" · ") || "Recipe"}</small><strong>{item.name}</strong><b>Open profile ↗</b></span></button>)}</div></div> : null}
      {results.foods.length ? <div className="result-block"><div className="result-block-title"><h3>{mode === "nutrients" ? `Ranked by ${nutrient}` : "Nutrition records"}</h3><span>USDA FoodData Central</span></div><div className="nutrition-grid">{results.foods.map((food) => <FoodNutrition food={food} focus={mode === "nutrients" ? nutrient : undefined} key={food.fdc_id} />)}</div></div> : null}
      {results.chemistry.foods.length || results.chemistry.compounds.length ? <div className="result-block chemistry-results"><div className="result-block-title"><h3>Food chemistry</h3><span>FooDB · PostgreSQL index</span></div><div className="chemistry-columns"><div><small>MATCHED INGREDIENTS</small>{results.chemistry.foods.map((food) => <button className="chemistry-food-row" key={food.public_id} onClick={() => void inspectIngredient(food.name)} type="button"><IngredientArtwork compact name={food.name} /><span>{food.public_id}</span><strong>{food.name}</strong><em>{food.scientific_name || food.food_subgroup}</em><small>{(food.relation_count || 0).toLocaleString()} reported · {(food.quantified_count || 0).toLocaleString()} quantified</small></button>)}</div><div><small>COMPOUNDS IN MATCHED INGREDIENTS</small>{results.chemistry.compounds.length ? results.chemistry.compounds.map((compound) => <a href={`https://foodb.ca/compounds/${compound.public_id}`} key={compound.public_id} rel="noreferrer" target="_blank"><span>{compound.public_id}</span><strong>{compound.name}</strong><em>{compound.superclass || compound.class_name || "Food compound"}</em><small className="compound-evidence">{compound.evidence_type === "direct_compound_match" ? "Direct name match" : `${compound.food_match_count || 1} matched food${compound.food_match_count === 1 ? "" : "s"} · ${compound.evidence_type === "quantified_food_relation" ? "quantified record" : "reported relation"}`}</small></a>) : <p className="compound-list-empty">These ingredient matches do not have usable compound relations yet.</p>}</div></div></div> : null}
      {!resultCount && !loading ? <div className="library-empty"><strong>No exact match crossed all three sources.</strong><p>Try an English common ingredient name, a broader dish name, or switch to a single source view.</p></div> : null}
    </section> : <section className="library-discovery site-container">
      <header className="library-section-heading"><div><span>START WITH A DISH</span><h2>A living shelf of ideas</h2></div><p>Open a dish to see its recipe, then move deeper into the nutritional and chemical identity of each ingredient.</p></header>
      <div className="meal-grid featured">{featured.map((item, index) => <button className={`meal-card ${index === 0 ? "lead" : ""}`} key={item.id} onClick={() => void openMeal(item.id)} type="button"><span className="meal-card-image"><Image alt="" fill sizes="(max-width: 700px) 90vw, 30vw" src={item.image} unoptimized /></span><span className="meal-card-copy"><small>{item.category || "Collection"}</small><strong>{item.name}</strong><b>Explore dish ↗</b></span></button>)}</div>
      {loading ? <div className="library-skeleton"><i /><i /><i /></div> : null}
      <div className="category-strip">{categories.slice(0, 8).map((category) => <button key={category.name} onClick={() => { setMode("meals"); setQuery(category.name); void search(undefined, category.name, "meals"); }} type="button"><Image alt="" height={64} src={category.image} unoptimized width={64} /><span><strong>{category.name}</strong><small>Browse collection</small></span></button>)}</div>
    </section>}

    {(meal || ingredient || detailLoading) ? <div className="food-profile-layer" role="dialog" aria-modal="true" aria-label="Food intelligence profile"><button aria-label="Close profile" className="profile-backdrop" onClick={() => { setMeal(null); setIngredient(null); }} type="button" /><section className="food-profile">
      <button aria-label="Close profile" className="profile-close" onClick={() => { setMeal(null); setIngredient(null); }} type="button">×</button>
      {detailLoading && !meal && !ingredient ? <div className="profile-loading"><i /> Assembling the food profile…</div> : null}
      {meal ? <><div className="profile-hero"><Image alt={meal.name} fill sizes="(max-width: 800px) 100vw, 45vw" src={meal.image} unoptimized /><div><span>{meal.area} · {meal.category}</span><h2>{meal.name}</h2><div>{meal.tags.map((tag) => <small key={tag}>{tag}</small>)}</div></div></div><div className="profile-body"><section className="recipe-column"><div className="profile-label"><span>RECIPE MAP</span><small>{meal.ingredients.length} ingredients</small></div><div className="ingredient-map">{meal.ingredients.map((item) => <button className={activeProfile?.name === item.name ? "active" : ""} key={`${item.name}-${item.measure}`} onClick={() => void inspectIngredient(item.name)} type="button"><span>{item.measure || "to taste"}</span><strong>{item.name}</strong><b>＋</b></button>)}</div><div className="method-copy"><span>METHOD</span><p>{meal.instructions}</p></div></section><ProfileIntelligence profile={activeProfile} foodbMatch={foodbMatch} /><aside className="profile-actions"><Link href={`/chat?prompt=${encodeURIComponent(`Help me cook ${meal.name}. Use this ingredient list: ${meal.ingredients.map((item) => `${item.measure} ${item.name}`).join(", ")}. Explain the important chemistry and safety decisions.`)}`}>Ask Hestia about this dish <span>↗</span></Link>{meal.source_url ? <a href={meal.source_url} rel="noreferrer" target="_blank">Original recipe ↗</a> : null}<small>Nutrition shown is for matched ingredient records, not a calculated total for the whole recipe.</small></aside></div></> : ingredient ? <div className="standalone-ingredient"><div className="ingredient-portrait"><Image alt={ingredient.name} fill sizes="300px" src={ingredient.image} unoptimized /></div><div><span className="site-eyebrow">Ingredient intelligence</span><h2>{ingredient.name}</h2><ProfileIntelligence profile={ingredient} foodbMatch={foodbMatch} /></div></div> : null}
    </section></div> : null}
  </>;
}

function ProfileIntelligence({ profile, foodbMatch }: { profile?: IngredientProfile; foodbMatch?: IngredientProfile["chemistry"]["matched"][number] }) {
  if (!profile) return <section className="intelligence-column"><p>Select an ingredient to map its nutrition and food chemistry.</p></section>;
  const nutrition = profile.nutrition_matches?.[0];
  const compounds = foodbMatch?.representative_records
    || foodbMatch?.representative_quantified_records
    || [];
  return <section className="intelligence-column"><div className="profile-label"><span>INGREDIENT LENS</span><small>{profile.name}</small></div>{nutrition ? <div className="compact-nutrition"><div><span>USDA MATCH</span><a href={nutrition.source_url} rel="noreferrer" target="_blank">FDC {nutrition.fdc_id} ↗</a></div><h3>{nutrition.name}</h3><div>{["energy", "protein", "fat", "carbohydrate", "fiber"].map((key) => nutrition.nutrients[key] ? <span key={key}><small>{key}</small><strong>{nutrition.nutrients[key].value}</strong><b>{nutrition.nutrients[key].unit}</b></span> : null)}</div><p>{nutrition.basis}</p></div> : <div className="profile-empty">No close USDA nutrient record was returned.</div>}{foodbMatch ? <div className="compound-profile"><div><span>FOODB MATCH</span><a href={`https://foodb.ca/foods/${foodbMatch.food.foodb_id}`} rel="noreferrer" target="_blank">{foodbMatch.food.foodb_id} ↗</a></div><h3>{foodbMatch.food.name}</h3><p><em>{foodbMatch.food.scientific_name}</em> · {foodbMatch.relation_count.toLocaleString()} reported compound relations</p>{compounds.length ? <><small className={`compound-record-kind ${foodbMatch.record_evidence === "reported" ? "reported" : ""}`}>{foodbMatch.record_evidence === "reported" ? "Reported relations · quantities unavailable" : "Quantified records"}</small><div className="compound-cloud">{compounds.slice(0, 7).map((compound) => <a href={`https://foodb.ca/compounds/${compound.public_id}`} key={compound.public_id} rel="noreferrer" target="_blank"><strong>{compound.name}</strong><small>{compound.superclass || compound.public_id}</small></a>)}</div></> : <div className="profile-empty inline">No usable compound records were returned for this match.</div>}</div> : <div className="profile-empty">No confident FooDB ingredient match. Hestia will not force a weak mapping.</div>}</section>;
}
