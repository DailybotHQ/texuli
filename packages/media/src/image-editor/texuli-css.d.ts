// texuli/button imports './button.css' without a sibling declaration, which
// only texuli's own program declares. Remove once button.css.d.ts lands.
declare module '*.css' {}
