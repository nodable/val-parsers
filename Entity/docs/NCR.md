
## NCR (Numeric Character Reference)

Represent a specific character from the Universal Character Set (UCS/Unicode). They are particularly useful for displaying characters that cannot be typed directly on a keyboard or characters that would otherwise be interpreted as code (like using `&#60;` for the `<` symbol).

An NCR can be written in two formats:

- Decimal: `&#[decimal];` (e.g., `&#160`; for a non-breaking space).
- Hexadecimal: `&#x[hex]; `(e.g., `&#xA0;` for the same space).

### Range of NCRs

The theoretical range for NCRs covers the entire Unicode space, from **U+0000** to **U+10FFFF**. However, not every value in this range is a "legal" character.

- **Total Range:** 0 to 1,114,111 (decimal).
- **Surrogate Pairs:** The range `U+D800` to `U+DFFF` is reserved for UTF-16 surrogate pairs and is generally prohibited as standalone NCRs.
- **Non-characters:** Certain values (ending in `FFFE` or `FFFF`) are reserved and should not be used for data exchange.

### Handling in XML 1.0 vs. XML 1.1

#### 1. XML 1.0 (The Strict Standard)

XML 1.0 is quite restrictive regarding "Control Characters."
- **Prohibited Characters:** Most C0 control characters (range `U+0000` to `U+001F`) are strictly forbidden, even if you try to escape them using an NCR. For example, `&#x07;` (a bell sound) will cause a well-formedness error in an XML 1.0 parser.
- **Allowed Exceptions:** Only the carriage return (`&#x0D;`), line feed (`&#x0A;`), and horizontal tab (`&#x09;`) are permitted.

#### 2. XML 1.1 (The Inclusive Standard)

XML 1.1 was designed to be more "robust" by allowing almost any Unicode character to be represented via NCR.
- **Expanded Support:** It allows the use of control characters that were previously banned in 1.0.
- **Requirement:** While these characters are allowed, they **must** be represented as NCRs (e.g., you still can't type a "null" character directly, but you can use `&#x00;` in some contexts, though `U+0000` remains controversial and often restricted even in 1.1).
- **C1 Controls:** Characters in the `U+0080` to `U+009F` range must also be escaped as NCRs in 1.1 for clarity and compatibility.

---


Here's a concrete test table covering the meaningful boundary cases. `\x1B` (ESC, U+001B) is a C0 control — I've highlighted it.

|Input|Codepoint|Class|XML 1.0 result|XML 1.1 result|
|---|---|---|---|---|
|`&#x09;`|U+0009|Tab (C0 allowed)|`\t`|`\t`|
|`&#x0A;`|U+000A|LF (C0 allowed)|`\n`|`\n`|
|`&#x0D;`|U+000D|CR (C0 allowed)|`\r`|`\r`|
|`&#x00;`|U+0000|Null|removed (always)|removed (always)|
|`&#x07;`|U+0007|BEL (C0 prohibited)|removed/throw|`\x07` ✓|
|**`&#x1B;`**|**U+001B**|**ESC (C0 prohibited)**|**removed/throw**|**`\x1B` ✓**|
|`&#27;`|U+001B|same, decimal form|same as above|`\x1B` ✓|
|`&#xD800;`|U+D800|Surrogate|removed (always)|removed (always)|
|`&#xFFFE;`|U+FFFE|Non-character|decoded (no special rule)|decoded|
|`&#x80;`|U+0080|C1 control|decoded as-is|decoded as-is|
|`&#x41;`|U+0041|'A' (safe ASCII)|`A`|`A`|
|`&#x10FFFF;`|U+10FFFF|Max codepoint|decoded|decoded|

Key observations:

- U+001B in decimal (`&#27;`) and hex (`&#x1B;`) are identical — both are ESC.
- The only difference between XML 1.0 and 1.1 is the C0 range U+0001–U+001F (excluding tab/LF/CR). Those 28 codepoints go from **prohibited → allowed** when you switch to 1.1.
- Surrogates and null are prohibited in both versions unconditionally.