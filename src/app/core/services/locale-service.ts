import { Injectable, signal, computed, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PrimeNG } from 'primeng/config';

export type AppLocale = 'en' | 'nl' | 'fr' | 'ar';

export interface LocaleOption {
  code: AppLocale;
  label: string;
  /** BCP-47 language tag for html[lang] */
  bcp47: string;
  rtl: boolean;
}

export const LOCALE_OPTIONS: LocaleOption[] = [
  { code: 'en', label: 'English', bcp47: 'en', rtl: false },
  { code: 'nl', label: 'Nederlands', bcp47: 'nl', rtl: false },
  { code: 'fr', label: 'Français', bcp47: 'fr', rtl: false },
  { code: 'ar', label: 'العربية', bcp47: 'ar', rtl: true },
];

const RTL_LOCALES = new Set<AppLocale>(['ar']);
const STORAGE_KEY = 'smart-access-locale';
const DEFAULT_LOCALE: AppLocale = 'en';

const PRIMENG_TRANSLATIONS: Record<AppLocale, Record<string, unknown>> = {
  en: {
    startsWith: 'Starts with',
    contains: 'Contains',
    notContains: 'Not contains',
    endsWith: 'Ends with',
    equals: 'Equals',
    notEquals: 'Not equals',
    noFilter: 'No Filter',
    lt: 'Less than',
    lte: 'Less than or equal to',
    gt: 'Greater than',
    gte: 'Greater than or equal to',
    dateIs: 'Date is',
    dateIsNot: 'Date is not',
    dateBefore: 'Date is before',
    dateAfter: 'Date is after',
    clear: 'Clear',
    apply: 'Apply',
    matchAll: 'Match All',
    matchAny: 'Match Any',
    addRule: 'Add Rule',
    removeRule: 'Remove Rule',
    accept: 'Yes',
    reject: 'No',
    choose: 'Choose',
    upload: 'Upload',
    cancel: 'Cancel',
    today: 'Today',
    weekHeader: 'Wk',
    firstDayOfWeek: 0,
    dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    dayNamesMin: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    monthNames: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ],
    monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dateFormat: 'mm/dd/yy',
    emptyMessage: 'No results found',
    emptyFilterMessage: 'No results found',
    aria: { trueLabel: 'True', falseLabel: 'False', nullLabel: 'Not Selected', star: '1 star', stars: '{0} stars', selectAll: 'All items selected', unselectAll: 'All items unselected', close: 'Close' },
  },
  nl: {
    startsWith: 'Begint met',
    contains: 'Bevat',
    notContains: 'Bevat niet',
    endsWith: 'Eindigt op',
    equals: 'Gelijk aan',
    notEquals: 'Niet gelijk aan',
    noFilter: 'Geen filter',
    lt: 'Kleiner dan',
    lte: 'Kleiner dan of gelijk aan',
    gt: 'Groter dan',
    gte: 'Groter dan of gelijk aan',
    dateIs: 'Datum is',
    dateIsNot: 'Datum is niet',
    dateBefore: 'Datum is voor',
    dateAfter: 'Datum is na',
    clear: 'Wissen',
    apply: 'Toepassen',
    matchAll: 'Alles matchen',
    matchAny: 'Willekeurig matchen',
    addRule: 'Regel toevoegen',
    removeRule: 'Regel verwijderen',
    accept: 'Ja',
    reject: 'Nee',
    choose: 'Kiezen',
    upload: 'Uploaden',
    cancel: 'Annuleren',
    today: 'Vandaag',
    weekHeader: 'Wk',
    firstDayOfWeek: 1,
    dayNames: ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'],
    dayNamesShort: ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'],
    dayNamesMin: ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'],
    monthNames: [
      'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
      'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
    ],
    monthNamesShort: ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'],
    dateFormat: 'dd/mm/yy',
    emptyMessage: 'Geen resultaten gevonden',
    emptyFilterMessage: 'Geen resultaten gevonden',
    aria: { trueLabel: 'Waar', falseLabel: 'Onwaar', nullLabel: 'Niet geselecteerd', star: '1 ster', stars: '{0} sterren', selectAll: 'Alle items geselecteerd', unselectAll: 'Alle items gedeselecteerd', close: 'Sluiten' },
  },
  fr: {
    startsWith: 'Commence par',
    contains: 'Contient',
    notContains: 'Ne contient pas',
    endsWith: 'Se termine par',
    equals: 'Égal à',
    notEquals: 'Différent de',
    noFilter: 'Aucun filtre',
    lt: 'Inférieur à',
    lte: 'Inférieur ou égal à',
    gt: 'Supérieur à',
    gte: 'Supérieur ou égal à',
    dateIs: 'La date est',
    dateIsNot: "La date n'est pas",
    dateBefore: 'La date est avant',
    dateAfter: 'La date est après',
    clear: 'Effacer',
    apply: 'Appliquer',
    matchAll: 'Correspondre à tout',
    matchAny: "Correspondre à n'importe lequel",
    addRule: 'Ajouter une règle',
    removeRule: 'Supprimer la règle',
    accept: 'Oui',
    reject: 'Non',
    choose: 'Choisir',
    upload: 'Télécharger',
    cancel: 'Annuler',
    today: "Aujourd'hui",
    weekHeader: 'Sem',
    firstDayOfWeek: 1,
    dayNames: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
    dayNamesShort: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
    dayNamesMin: ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'],
    monthNames: [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
    ],
    monthNamesShort: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
    dateFormat: 'dd/mm/yy',
    emptyMessage: 'Aucun résultat trouvé',
    emptyFilterMessage: 'Aucun résultat trouvé',
    aria: { trueLabel: 'Vrai', falseLabel: 'Faux', nullLabel: 'Non sélectionné', star: '1 étoile', stars: '{0} étoiles', selectAll: 'Tous les éléments sélectionnés', unselectAll: 'Tous les éléments désélectionnés', close: 'Fermer' },
  },
  ar: {
    startsWith: 'يبدأ بـ',
    contains: 'يحتوي على',
    notContains: 'لا يحتوي على',
    endsWith: 'ينتهي بـ',
    equals: 'يساوي',
    notEquals: 'لا يساوي',
    noFilter: 'بلا فلتر',
    lt: 'أقل من',
    lte: 'أقل من أو يساوي',
    gt: 'أكبر من',
    gte: 'أكبر من أو يساوي',
    dateIs: 'التاريخ هو',
    dateIsNot: 'التاريخ ليس',
    dateBefore: 'التاريخ قبل',
    dateAfter: 'التاريخ بعد',
    clear: 'مسح',
    apply: 'تطبيق',
    matchAll: 'مطابقة الكل',
    matchAny: 'مطابقة أي',
    addRule: 'إضافة قاعدة',
    removeRule: 'حذف القاعدة',
    accept: 'نعم',
    reject: 'لا',
    choose: 'اختر',
    upload: 'رفع',
    cancel: 'إلغاء',
    today: 'اليوم',
    weekHeader: 'أسبوع',
    firstDayOfWeek: 6,
    dayNames: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    dayNamesShort: ['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'],
    dayNamesMin: ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'],
    monthNames: [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
    ],
    monthNamesShort: ['ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون', 'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس'],
    dateFormat: 'dd/mm/yy',
    emptyMessage: 'لا توجد نتائج',
    emptyFilterMessage: 'لا توجد نتائج',
    aria: { trueLabel: 'صحيح', falseLabel: 'خطأ', nullLabel: 'غير محدد', star: 'نجمة واحدة', stars: '{0} نجوم', selectAll: 'جميع العناصر محددة', unselectAll: 'جميع العناصر غير محددة', close: 'إغلاق' },
  },
};

/** Reads the persisted locale from localStorage, falling back to the default. */
function resolveInitialLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as AppLocale | null;
    if (stored && LOCALE_OPTIONS.some(l => l.code === stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable (SSR / private browsing)
  }
  return DEFAULT_LOCALE;
}

/** Applies dir and lang attributes to the document root element. */
function applyDocumentDirection(locale: AppLocale): void {
  const opt = LOCALE_OPTIONS.find(l => l.code === locale)!;
  document.documentElement.setAttribute('lang', opt.bcp47);
  document.documentElement.setAttribute('dir', opt.rtl ? 'rtl' : 'ltr');
}

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private translate = inject(TranslateService);
  private primeNG = inject(PrimeNG);

  private _locale = signal<AppLocale>(resolveInitialLocale());

  /** Currently active locale — read-only signal. */
  readonly locale = this._locale.asReadonly();

  /** True when the active locale uses RTL text direction. */
  readonly isRtl = computed(() => RTL_LOCALES.has(this._locale()));

  /** Ordered list of all supported locale options. */
  readonly localeOptions = LOCALE_OPTIONS;

  /** Initialises the translate service and applies the stored or default locale.
   *  Call once from the root component's constructor. */
  initialize(): void {
    this.translate.addLangs(LOCALE_OPTIONS.map(l => l.code));
    this.translate.setDefaultLang(DEFAULT_LOCALE);
    this.applyLocale(this._locale());
  }

  /** Switches the active language, persists the choice, and updates the DOM. */
  setLocale(locale: AppLocale): void {
    if (locale === this._locale()) return;
    this._locale.set(locale);
    this.applyLocale(locale);
    this.persistLocale(locale);
  }

  private applyLocale(locale: AppLocale): void {
    this.translate.use(locale);
    applyDocumentDirection(locale);
    this.primeNG.setTranslation(PRIMENG_TRANSLATIONS[locale]);
  }

  private persistLocale(locale: AppLocale): void {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // localStorage unavailable — silently skip persistence
    }
  }
}
