// Maps field names to semantic categories using a three-tier lookup:
// 1. Exact normalized match (fastest, handles the most common cases)
// 2. Multi-token rule match (handles combinations like [image, url] → IMAGE_URL)
// 3. Single-token match (handles any field containing a known token)

export type SemanticCategory =
  | 'ID'
  | 'PERSON_NAME'
  | 'FIRST_NAME'
  | 'LAST_NAME'
  | 'EMAIL'
  | 'PHONE'
  | 'URL'
  | 'IMAGE_URL'
  | 'DATE'
  | 'DATE_ONLY'
  | 'PRICE'
  | 'QUANTITY'
  | 'AGE'
  | 'STATUS'
  | 'SLUG'
  | 'COMPANY'
  | 'JOB_TITLE'
  | 'ADDRESS'
  | 'CITY'
  | 'COUNTRY'
  | 'ZIP'
  | 'LOCALE'
  | 'CURRENCY'
  | 'COLOR'
  | 'BOOLEAN_POSITIVE'
  | 'BOOLEAN_NEGATIVE'
  | 'VERSION'
  | 'TOKEN'
  | 'IP'

// Splits a field name into lowercase tokens, handling camelCase, PascalCase,
// snake_case, kebab-case, and acronyms (e.g. imageURL → ['image', 'url']).
function splitTokens(fieldName: string): string[] {
  const result: string[] = []

  // First split on explicit separators
  const segments: string[] = []
  let seg = ''
  for (const ch of fieldName) {
    if (ch === '_' || ch === '-' || ch === '.' || ch === ' ') {
      if (seg) { segments.push(seg); seg = '' }
    } else {
      seg += ch
    }
  }
  if (seg) segments.push(seg)

  // Then split each segment on camelCase/PascalCase/acronym boundaries
  for (const s of segments) {
    let word = ''
    for (let i = 0; i < s.length; i++) {
      const ch = s[i]
      const isUpper = ch >= 'A' && ch <= 'Z'
      const prevIsLower = word.length > 0 && word[word.length - 1] >= 'a' && word[word.length - 1] <= 'z'
      // End of acronym boundary: e.g. 'L' in 'URLPath' → next is lowercase and word > 1 char
      const nextIsLower = i + 1 < s.length && s[i + 1] >= 'a' && s[i + 1] <= 'z'

      if (isUpper && (prevIsLower || (nextIsLower && word.length > 1))) {
        if (word) result.push(word.toLowerCase())
        word = ch
      } else {
        word += ch
      }
    }
    if (word) result.push(word.toLowerCase())
  }

  return result.filter(t => t.length > 0)
}

// Strips separators and lowercases — used for tier-1 exact key lookup.
function normalizeExact(fieldName: string): string {
  let out = ''
  for (const ch of fieldName) {
    if (ch !== '_' && ch !== '-' && ch !== '.' && ch !== ' ') {
      out += ch.toLowerCase()
    }
  }
  return out
}

// Tier-1: exact normalized name → category
const EXACT_MATCH: Record<string, SemanticCategory> = {
  id: 'ID', uuid: 'ID', guid: 'ID',
  userid: 'ID', productid: 'ID', orderid: 'ID', itemid: 'ID', postid: 'ID',
  fullname: 'PERSON_NAME', displayname: 'PERSON_NAME',
  firstname: 'FIRST_NAME', givenname: 'FIRST_NAME',
  lastname: 'LAST_NAME', surname: 'LAST_NAME', familyname: 'LAST_NAME',
  email: 'EMAIL', emailaddress: 'EMAIL',
  phone: 'PHONE', phonenumber: 'PHONE', mobile: 'PHONE', telephone: 'PHONE',
  url: 'URL', website: 'URL', link: 'URL', href: 'URL',
  imageurl: 'IMAGE_URL', avatarurl: 'IMAGE_URL', photourl: 'IMAGE_URL',
  thumbnail: 'IMAGE_URL', photo: 'IMAGE_URL', avatar: 'IMAGE_URL', profilepicture: 'IMAGE_URL',
  createdat: 'DATE', updatedat: 'DATE', modifiedat: 'DATE', deletedat: 'DATE',
  timestamp: 'DATE', date: 'DATE', publishedat: 'DATE', createdon: 'DATE', updatedon: 'DATE',
  birthdate: 'DATE_ONLY', dateofbirth: 'DATE_ONLY', dob: 'DATE_ONLY',
  expirydate: 'DATE_ONLY', expiration: 'DATE_ONLY', expirationdate: 'DATE_ONLY',
  price: 'PRICE', cost: 'PRICE', amount: 'PRICE', total: 'PRICE', fee: 'PRICE',
  subtotal: 'PRICE', discount: 'PRICE',
  count: 'QUANTITY', quantity: 'QUANTITY', stock: 'QUANTITY', qty: 'QUANTITY',
  age: 'AGE',
  status: 'STATUS', state: 'STATUS',
  slug: 'SLUG', handle: 'SLUG', username: 'SLUG',
  company: 'COMPANY', companyname: 'COMPANY', organization: 'COMPANY', organisation: 'COMPANY',
  role: 'JOB_TITLE', jobtitle: 'JOB_TITLE', position: 'JOB_TITLE', occupation: 'JOB_TITLE',
  address: 'ADDRESS', streetaddress: 'ADDRESS', street: 'ADDRESS',
  city: 'CITY', town: 'CITY',
  country: 'COUNTRY', countryname: 'COUNTRY',
  zip: 'ZIP', zipcode: 'ZIP', postal: 'ZIP', postalcode: 'ZIP', postcode: 'ZIP',
  locale: 'LOCALE', language: 'LOCALE', lang: 'LOCALE',
  currency: 'CURRENCY', currencycode: 'CURRENCY',
  color: 'COLOR', colour: 'COLOR', hex: 'COLOR', background: 'COLOR', backgroundcolor: 'COLOR',
  isactive: 'BOOLEAN_POSITIVE', enabled: 'BOOLEAN_POSITIVE', isenabled: 'BOOLEAN_POSITIVE',
  isverified: 'BOOLEAN_POSITIVE', ispublished: 'BOOLEAN_POSITIVE',
  isvisible: 'BOOLEAN_POSITIVE', isopen: 'BOOLEAN_POSITIVE', isavailable: 'BOOLEAN_POSITIVE',
  isdeleted: 'BOOLEAN_NEGATIVE', isdisabled: 'BOOLEAN_NEGATIVE',
  isbanned: 'BOOLEAN_NEGATIVE', isarchived: 'BOOLEAN_NEGATIVE', ishidden: 'BOOLEAN_NEGATIVE',
  version: 'VERSION', semver: 'VERSION',
  token: 'TOKEN', accesstoken: 'TOKEN', refreshtoken: 'TOKEN',
  apikey: 'TOKEN', secretkey: 'TOKEN', secret: 'TOKEN',
  ipaddress: 'IP', ip: 'IP',
}

// Tier-2a: multi-token rules (checked before single-token to handle disambiguation)
type MultiRule = [tokens: string[], category: SemanticCategory]

const MULTI_TOKEN_RULES: MultiRule[] = [
  [['first', 'name'], 'FIRST_NAME'],
  [['last', 'name'], 'LAST_NAME'],
  [['given', 'name'], 'FIRST_NAME'],
  [['family', 'name'], 'LAST_NAME'],
  [['full', 'name'], 'PERSON_NAME'],
  [['display', 'name'], 'PERSON_NAME'],
  [['image', 'url'], 'IMAGE_URL'],
  [['image', 'src'], 'IMAGE_URL'],
  [['avatar', 'url'], 'IMAGE_URL'],
  [['photo', 'url'], 'IMAGE_URL'],
  [['cover', 'image'], 'IMAGE_URL'],
  [['profile', 'picture'], 'IMAGE_URL'],
  [['job', 'title'], 'JOB_TITLE'],
  [['is', 'active'], 'BOOLEAN_POSITIVE'],
  [['is', 'enabled'], 'BOOLEAN_POSITIVE'],
  [['is', 'verified'], 'BOOLEAN_POSITIVE'],
  [['is', 'published'], 'BOOLEAN_POSITIVE'],
  [['is', 'visible'], 'BOOLEAN_POSITIVE'],
  [['is', 'deleted'], 'BOOLEAN_NEGATIVE'],
  [['is', 'disabled'], 'BOOLEAN_NEGATIVE'],
  [['is', 'banned'], 'BOOLEAN_NEGATIVE'],
  [['is', 'archived'], 'BOOLEAN_NEGATIVE'],
  [['api', 'key'], 'TOKEN'],
  [['access', 'token'], 'TOKEN'],
  [['refresh', 'token'], 'TOKEN'],
  [['ip', 'address'], 'IP'],
  [['phone', 'number'], 'PHONE'],
  [['birth', 'date'], 'DATE_ONLY'],
  [['date', 'birth'], 'DATE_ONLY'],
  [['expiry', 'date'], 'DATE_ONLY'],
  [['expiration', 'date'], 'DATE_ONLY'],
  [['created', 'at'], 'DATE'],
  [['updated', 'at'], 'DATE'],
  [['published', 'at'], 'DATE'],
  [['deleted', 'at'], 'DATE'],
  [['street', 'address'], 'ADDRESS'],
  [['zip', 'code'], 'ZIP'],
  [['postal', 'code'], 'ZIP'],
  [['background', 'color'], 'COLOR'],
  [['company', 'name'], 'COMPANY'],
  [['currency', 'code'], 'CURRENCY'],
]

// Tier-2b: single-token match (first matching token wins)
const SINGLE_TOKEN: Record<string, SemanticCategory> = {
  id: 'ID', uuid: 'ID', guid: 'ID',
  email: 'EMAIL',
  phone: 'PHONE', mobile: 'PHONE',
  url: 'URL', website: 'URL', link: 'URL', href: 'URL',
  image: 'IMAGE_URL', avatar: 'IMAGE_URL', photo: 'IMAGE_URL', thumbnail: 'IMAGE_URL',
  timestamp: 'DATE', created: 'DATE', updated: 'DATE', published: 'DATE', modified: 'DATE',
  dob: 'DATE_ONLY', expiry: 'DATE_ONLY', birth: 'DATE_ONLY', expiration: 'DATE_ONLY',
  price: 'PRICE', cost: 'PRICE', amount: 'PRICE', fee: 'PRICE', subtotal: 'PRICE',
  count: 'QUANTITY', quantity: 'QUANTITY', stock: 'QUANTITY', qty: 'QUANTITY',
  age: 'AGE',
  status: 'STATUS', state: 'STATUS',
  slug: 'SLUG', handle: 'SLUG', username: 'SLUG',
  company: 'COMPANY', organization: 'COMPANY', organisation: 'COMPANY',
  role: 'JOB_TITLE', position: 'JOB_TITLE', occupation: 'JOB_TITLE',
  address: 'ADDRESS', street: 'ADDRESS',
  city: 'CITY', town: 'CITY',
  country: 'COUNTRY',
  zip: 'ZIP', postal: 'ZIP', postcode: 'ZIP',
  locale: 'LOCALE', language: 'LOCALE', lang: 'LOCALE',
  currency: 'CURRENCY',
  color: 'COLOR', colour: 'COLOR', hex: 'COLOR', background: 'COLOR',
  version: 'VERSION', semver: 'VERSION',
  token: 'TOKEN', key: 'TOKEN', secret: 'TOKEN',
  ip: 'IP',
}

export function getSemanticCategory(fieldName: string): SemanticCategory | null {
  // Tier 1: exact normalized match
  const normalized = normalizeExact(fieldName)
  const exact = EXACT_MATCH[normalized]
  if (exact !== undefined) return exact

  // Tier 2: tokenize and match
  const tokens = splitTokens(fieldName)

  // Tier 2a: multi-token rules (specific combinations, checked first)
  for (const [ruleTokens, category] of MULTI_TOKEN_RULES) {
    if (ruleTokens.every(t => tokens.includes(t))) return category
  }

  // Tier 2b: single-token scan (first matching token wins)
  for (const token of tokens) {
    const cat = SINGLE_TOKEN[token]
    if (cat !== undefined) return cat
  }

  return null
}
