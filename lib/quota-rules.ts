/**
 * CartoMapper is free. The limits, shared by server and browser:
 *  • new maps per person per rolling 24 hours
 *  • changes in plain words per map (generous, but a map can't become an endless AI session)
 */
export const DAILY_MAP_LIMIT = 10;
export const CHANGES_PER_MAP = 20;
