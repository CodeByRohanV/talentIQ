import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window === 'undefined') return 'light';
        const saved = localStorage.getItem('theme') as Theme;
        return saved || 'light';
    });

    const applyTheme = useCallback((currentTheme: Theme) => {
        const root = window.document.documentElement;
        const body = window.document.body;

        // Standard Tailwind/Shadcn approach
        root.classList.remove('light', 'dark');

        let resolvedTheme: 'light' | 'dark' = 'light';
        if (currentTheme === 'system') {
            resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } else {
            resolvedTheme = currentTheme as 'light' | 'dark';
        }

        root.classList.add(resolvedTheme);

        // Mirroring Framer ThemeSwitcher logic (setting toggle-theme attribute)
        root.setAttribute('toggle-theme', resolvedTheme);
        body.setAttribute('toggle-theme', resolvedTheme);

        localStorage.setItem('theme', currentTheme);

        // Dispatch event as done in the Framer component
        window.dispatchEvent(new Event('themeChange'));
    }, []);

    useEffect(() => {
        applyTheme(theme);
    }, [theme, applyTheme]);

    // Initial setup for CSS token extraction logic if needed (matching Framer's extra step)
    useEffect(() => {
        // This part replicates the extractAndApplyThemeTokens logic for Framer users
        // who might have tokens defined in a way the component expects
        const extractAndApplyThemeTokens = () => {
            if (document.getElementById('toggle-theme-tokens')) return;

            const lightTokens: string[] = [];
            let darkTokensCombined = "";

            for (let i = 0; i < document.styleSheets.length; i++) {
                const sheet = document.styleSheets[i];
                try {
                    const rules = sheet.cssRules || [];
                    for (let k = 0; k < rules.length; k++) {
                        const rule = rules[k] as CSSStyleRule;
                        if (rule.selectorText === 'body') {
                            const style = rule.style;
                            for (let j = 0; j < style.length; j++) {
                                const prop = style[j];
                                if (prop.includes('--token')) {
                                    lightTokens.push(`${prop}: ${style.getPropertyValue(prop)};`);
                                }
                            }
                        } else if (rule instanceof CSSMediaRule && rule.conditionText === '(prefers-color-scheme: dark)') {
                            const mediaRules = rule.cssRules;
                            if (mediaRules.length > 0) {
                                let cssText = (mediaRules[0] as CSSStyleRule).cssText;
                                cssText = cssText.replace('body', '').replace(/\s*{\s*/, '').replace(/\s*}\s*$/, '');
                                darkTokensCombined = cssText;
                            }
                        }
                    }
                } catch (e) { /* cross-origin */ }
            }

            const style = document.createElement('style');
            style.id = 'toggle-theme-tokens';
            style.textContent = `
        body[toggle-theme="light"] { ${lightTokens.join(' ')} }
        body[toggle-theme="dark"] { ${darkTokensCombined} }
        html[toggle-theme="light"] { color-scheme: light; }
        html[toggle-theme="dark"] { color-scheme: dark; }
      `;
            document.head.appendChild(style);
        };

        extractAndApplyThemeTokens();
    }, []);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
    };

    const toggleTheme = () => {
        setThemeState(prev => (prev === 'light' ? 'dark' : 'light') as Theme);
    };

    return { theme, setTheme, toggleTheme };
}
