import { useState } from "react";
import { useLanguage } from "./language";
import { translateUi } from "./translations";

export function StructuredField({
  field,
  members,
}: {
  field: { name: string; value?: string };
  members: { id: string; name: string; email?: string }[];
}) {
  const { bn, t } = useLanguage(),
    ui = (text: string) => translateUi(text, bn);
  const [value, setValue] = useState<any>(() =>
    JSON.parse(field.value || "{}"),
  );
  const [category, setCategory] = useState("");
  const title = {
    weekdays: t("Repeat on", "যে দিনগুলোতে মিল চলবে"),
    weights: t("Meal weights", "মিলের ওজন"),
    categories: t("Expense sharing rules", "খরচ ভাগের নিয়ম"),
    items: t("Purchase items (optional)", "বাজারের পণ্য (ঐচ্ছিক)"),
    fixed: t(
      "Fixed member shares (only for fixed allocation)",
      "সদস্যের নির্দিষ্ট ভাগ (শুধু নির্দিষ্ট ভাগের নিয়মে)",
    ),
  }[field.name];
  const set = (key: string, next: any) => setValue({ ...value, [key]: next });
  return (
    <fieldset className="structured-field">
      <legend>{title}</legend>
      <input type="hidden" name={field.name} value={JSON.stringify(value)} />
      {field.name === "weekdays" &&
        [
          t("Sunday", "রবিবার"),
          t("Monday", "সোমবার"),
          t("Tuesday", "মঙ্গলবার"),
          t("Wednesday", "বুধবার"),
          t("Thursday", "বৃহস্পতিবার"),
          t("Friday", "শুক্রবার"),
          t("Saturday", "শনিবার"),
        ].map((day, i) => (
          <label key={day} className="checkbox-label">
            <input
              type="checkbox"
              checked={value.includes(i)}
              onChange={(e) =>
                setValue(
                  e.target.checked
                    ? [...value, i].sort()
                    : value.filter((n: number) => n !== i),
                )
              }
            />
            {day}
          </label>
        ))}
      {field.name === "weights" &&
        ["breakfast", "lunch", "dinner"].map((slot) => (
          <label key={slot}>
            {ui(slot)}
            <input
              type="number"
              required
              min="1"
              max="4"
              step="1"
              value={value[slot]}
              onChange={(e) => set(slot, Number(e.target.value))}
            />
          </label>
        ))}
      {field.name === "categories" && (
        <>
          {Object.entries(value).map(([name, split]) => (
            <label key={name}>
              {ui(name)}
              <select
                value={String(split)}
                onChange={(e) => set(name, e.target.value)}
              >
                {["meal", "equal", "occupancy", "fixed"].map((rule) => (
                  <option value={rule} key={rule}>
                    {ui(rule)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <div className="row-actions">
            <input
              aria-label={t("New category name", "নতুন খাতের নাম")}
              value={category}
              maxLength={40}
              onChange={(e) => setCategory(e.target.value)}
            />
            <button
              type="button"
              className="button outline"
              onClick={() => {
                if (
                  category.trim() &&
                  !["__proto__", "constructor", "prototype"].includes(
                    category.trim(),
                  )
                ) {
                  set(category.trim(), "equal");
                  setCategory("");
                }
              }}
            >
              {t("Add category", "খাত যোগ করুন")}
            </button>
          </div>
        </>
      )}
      {field.name === "fixed" &&
        members.map((member) => (
          <label key={member.id}>
            {member.name} · ৳
            <input
              type="number"
              min="0"
              step="0.01"
              defaultValue={value[member.id] ? value[member.id] / 100 : ""}
              onChange={(e) => {
                const next = { ...value };
                if (e.target.value)
                  next[member.id] = Math.round(Number(e.target.value) * 100);
                else delete next[member.id];
                setValue(next);
              }}
            />
          </label>
        ))}
      {field.name === "items" && (
        <>
          {value.map((item: any, i: number) => (
            <div className="item-editor" key={i}>
              {[
                ["name", t("Item", "পণ্য")],
                ["quantity", t("Quantity", "পরিমাণ")],
                ["unit", t("Unit", "একক")],
                ["paisa", t("Total price (৳)", "মোট দাম (৳)")],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    required
                    type={
                      ["quantity", "paisa"].includes(key) ? "number" : "text"
                    }
                    min={key === "quantity" ? "0.001" : "0"}
                    step={key === "quantity" ? "0.001" : "0.01"}
                    value={key === "paisa" ? item[key] / 100 : item[key]}
                    onChange={(e) => {
                      const next = [...value];
                      next[i] = {
                        ...item,
                        [key]:
                          key === "paisa"
                            ? Math.round(Number(e.target.value) * 100)
                            : key === "quantity"
                              ? Number(e.target.value)
                              : e.target.value,
                      };
                      setValue(next);
                    }}
                  />
                </label>
              ))}
              <button
                type="button"
                className="button outline"
                onClick={() =>
                  setValue(value.filter((_: any, n: number) => n !== i))
                }
              >
                {t("Remove item", "পণ্য বাদ দিন")}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button outline"
            onClick={() =>
              setValue([
                ...value,
                { name: "", quantity: 1, unit: "kg", paisa: 0 },
              ])
            }
          >
            {t("Add item", "পণ্য যোগ করুন")}
          </button>
          <p className="muted">
            {t(
              "Item totals must match the expense amount. Prices are whole item totals, not unit prices.",
              "সব পণ্যের মোট দাম খরচের টাকার সঙ্গে মিলতে হবে। এখানে প্রতিটি পণ্যের মোট দাম লিখুন, এককের দাম নয়।",
            )}
          </p>
        </>
      )}
    </fieldset>
  );
}
