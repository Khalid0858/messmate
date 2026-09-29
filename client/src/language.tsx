import React, { useState, useEffect, createContext, useContext } from "react";
const Language = createContext({
  bn: true,
  t: (en: string, bn: string) => bn,
  toggle: () => {},
});
export const useLanguage = () => useContext(Language);
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [bn, setBn] = useState(localStorage.getItem("language") !== "en");
  useEffect(() => {
    document.documentElement.lang = bn ? "bn" : "en";
  }, [bn]);
  return (
    <Language.Provider
      value={{
        bn,
        t: (en, b) => (bn ? b : en),
        toggle: () =>
          setBn((v) => {
            localStorage.setItem("language", v ? "en" : "bn");
            return !v;
          }),
      }}
    >
      {children}
    </Language.Provider>
  );
}
