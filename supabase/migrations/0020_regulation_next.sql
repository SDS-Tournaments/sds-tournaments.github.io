-- Регламент 2.1: партнёр NeXT — мод разрешён (п. 10.5–10.6). Остальной текст не меняется.
update public.app_settings set
  regulation_version = '2.1',
  regulation_ru = replace(regulation_ru,
    '**10.5. Модификации.** Запрещены все моды, читы, плагины и любые сторонние вмешательства в игру. Разрешён только стандартный контент игры.',
    '**10.5. Модификации.** Запрещены моды, читы, плагины и любые сторонние вмешательства в игру, кроме модов из п. 10.6.

**10.6. Разрешённые моды.** Разрешён мод **NeXT** — официальный партнёр SDS (разработчик @Envy, сервер: https://discord.gg/WXjfkqbEEH). Его функции (телепорт, замена шин, диностенд) можно использовать только вне заезда — между попытками и дуэлями. Использование функций мода во время заезда — нарушение регламента (п. 1.6).'),
  regulation_en = replace(regulation_en,
    '**10.5. Modifications.** All mods, cheats, plugins and any third-party interference with the game are prohibited. Only standard game content is allowed.',
    '**10.5. Modifications.** Mods, cheats, plugins and any third-party interference with the game are prohibited, except the mods listed in 10.6.

**10.6. Allowed mods.** The **NeXT** mod is allowed — an official SDS partner (developer @Envy, server: https://discord.gg/WXjfkqbEEH). Its features (teleport, tyre change, dyno) may only be used outside a run — between attempts and battles. Using the mod''s features during a run is a rule violation (1.6).')
where id = 1;
