import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { VideoView, useVideoPlayer } from 'expo-video';
import { StatusBar } from 'expo-status-bar';

void SplashScreen.preventAutoHideAsync().catch((error: unknown) => {
  console.error('Unable to keep the native splash screen visible.', error);
});

type ActivationForm = {
  code: string;
  mac: string;
  sn: string;
  chipid: string;
  model: string;
  firmware_ver: string;
};

type ActivationResult = {
  status?: number;
  message?: string;
  osd?: string;
  expire?: string;
  user_agent?: string;
  code_id?: string | number;
  error?: string;
};

type IptvPackage = { id: string; pkg_name: string; pkg_icon?: string };
type IptvChannel = {
  channel_name: string;
  stream_icon?: string;
  angle?: string;
  tp?: string | number | null;
  pol?: string;
  sid?: string | number | null;
  stream_url: string;
};
type MovieSubcategory = {
  sub_id: string;
  sub_name: string;
  sub_icon?: string;
  sub_view_order?: string | number;
};
type MovieCategory = {
  cat_id: string;
  cat_name: string;
  cat_icon?: string;
  cat_view_order?: string | number;
  sub_cats: MovieSubcategory[];
};
type MovieItem = {
  id: string;
  title: string;
  catid: string;
  icon?: string;
  view_order?: string | number;
  stream_url: string;
};
type MovieInfo = {
  id: string;
  stream_display_name: string;
  category_id?: string | number;
  stream_icon?: string;
  stream_url: string;
  movie_image?: string;
  genre?: string;
  plot?: string;
  cast?: string;
  duration?: string;
  bitrate?: number;
  rate?: number;
  rating?: number;
};
type SeriesItem = Record<string, unknown>;
type SeriesEpisode = {
  season_num: string | number;
  episode_num: string | number;
  episode_name: string;
  stream_url: string;
  stream_icon?: string;
};
type SportsChannel = { channel: IptvChannel; packageName: string };
type Notice = { title: string; detail?: string };
type ContentCategory = 'HOME' | 'LIVE' | 'SAT2IPTV' | 'SPORTS' | 'MOVIES' | 'SERIES' | 'KIDS' | 'QURAN' | 'RAMADAN' | 'SETTINGS';
type HomeTile = { id: Exclude<ContentCategory, 'HOME'>; label: string; icon: string; accent: string };
type SettingsSection = 'ACCOUNT' | 'ADVANCED' | 'APPEARANCE' | 'ABOUT';
type NavigationEntry = { category: ContentCategory; kidsFilter: boolean };

const settingsSections: { id: SettingsSection; label: string; icon: string }[] = [
  { id: 'ACCOUNT', label: 'Account', icon: '♟' },
  { id: 'ADVANCED', label: 'Advanced', icon: '⚙' },
  { id: 'APPEARANCE', label: 'Appearance', icon: '▦' },
  { id: 'ABOUT', label: 'About', icon: 'ⓘ' },
];

const contentCategories: { id: ContentCategory; label: string; title: string }[] = [
  { id: 'LIVE', label: 'لايف', title: 'القنوات المباشرة' },
  { id: 'SAT2IPTV', label: 'Sat2IPTV', title: 'قنوات Sat2IPTV' },
  { id: 'SPORTS', label: 'رياضة', title: 'القنوات الرياضية' },
  { id: 'MOVIES', label: 'أفلام', title: 'الأفلام' },
  { id: 'SERIES', label: 'مسلسلات', title: 'المسلسلات' },
  { id: 'SETTINGS', label: 'الإعدادات', title: 'الإعدادات' },
];

const homePrimaryTiles: HomeTile[] = [
  { id: 'LIVE', label: 'LIVE', icon: '◉', accent: '#25D9FF' },
  { id: 'SPORTS', label: 'SPORTS', icon: '◉', accent: '#D52EFF' },
];
const homeSecondaryTiles: HomeTile[] = [
  { id: 'MOVIES', label: 'movies', icon: '▤', accent: '#D52EFF' },
  { id: 'SERIES', label: 'series', icon: '▣', accent: '#25D9FF' },
  { id: 'KIDS', label: 'kids', icon: '☻', accent: '#D52EFF' },
  { id: 'QURAN', label: 'quran', icon: '▧', accent: '#25D9FF' },
  { id: 'RAMADAN', label: 'ramadan', icon: '☾', accent: '#D52EFF' },
  { id: 'SAT2IPTV', label: 'Sat2IPTV', icon: '◌', accent: '#D52EFF' },
  { id: 'SETTINGS', label: 'settings', icon: '⚙', accent: '#25D9FF' },
];

const kidsKeywords = ['kids', 'kid', 'children', 'أطفال', 'اطفال', 'طفل'];
const seriesThemeKeywords: Partial<Record<ContentCategory, string[]>> = {
  QURAN: ['quran', 'قرآن', 'قران'],
  RAMADAN: ['ramadan', 'رمضان'],
};

function matchesKeywords(value: string, keywords: string[]) {
  const normalized = value.toLocaleLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLocaleLowerCase()));
}

const storageKey = 'galaxytv.activation-form';
const sessionStorageKey = 'galaxytv.activation-session';
const apiUrl = 'http://gean4563t.xyz:80/V6/API-V6.php';
const xorKey = process.env.EXPO_PUBLIC_XOR_KEY?.trim();
const initialForm: ActivationForm = {
  code: '',
  mac: '',
  sn: '',
  chipid: '',
  model: '2000plus',
  firmware_ver: '1.2',
}

function isActivationForm(value: unknown): value is ActivationForm {
  return typeof value === 'object' && value !== null &&
    'code' in value && typeof value.code === 'string' &&
    'mac' in value && typeof value.mac === 'string' &&
    'sn' in value && typeof value.sn === 'string' &&
    'chipid' in value && typeof value.chipid === 'string' &&
    'model' in value && typeof value.model === 'string' &&
    'firmware_ver' in value && typeof value.firmware_ver === 'string';
}

function isSavedActivation(value: unknown): value is ActivationResult {
  return typeof value === 'object' && value !== null && 'status' in value && value.status === 100;
}

function encodeXorBase64(payload: Record<string, string>, key: string) {
  const keyBytes = new TextEncoder().encode(key);
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const encryptedBytes = payloadBytes.map((byte, index) => byte ^ keyBytes[index % keyBytes.length]);
  const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let encoded = '';

  for (let index = 0; index < encryptedBytes.length; index += 3) {
    const first = encryptedBytes[index];
    const second = encryptedBytes[index + 1];
    const third = encryptedBytes[index + 2];
    encoded += base64Alphabet[first >> 2];
    encoded += base64Alphabet[((first & 3) << 4) | ((second ?? 0) >> 4)];
    encoded += second === undefined ? '=' : base64Alphabet[((second & 15) << 2) | ((third ?? 0) >> 6)];
    encoded += third === undefined ? '=' : base64Alphabet[third & 63];
  }

  return encoded;
}

function decodeXorJson(responseBytes: Uint8Array, key: string) {
  const keyBytes = new TextEncoder().encode(key);
  const decryptedBytes = responseBytes.map((byte, index) => byte ^ keyBytes[index % keyBytes.length]);
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decryptedBytes)) as unknown;
}

function FormField({
  label,
  placeholder,
  value,
  onChangeText,
  autoCapitalize = 'none',
  keyboardType = 'default',
  wide = false,
}: {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (value: string) => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'url' | 'numeric' | 'number-pad';
  wide?: boolean;
}) {
  return (
    <View style={[styles.field, wide && styles.fieldWide]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        accessibilityLabel={label ?? placeholder}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        selectTextOnFocus
        style={styles.input}
        value={value}
      />
    </View>
  );
}

export default function App() {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 760;
  const homeMenuHeight = Math.max(150, Math.min(250, height - 210));
  const compactHomeLayout = width < 600;
  const catalogWidth = Math.min(width - 44, isWide ? 920 : 680);
  const browserSidebarWidth = Math.max(116, Math.min(220, catalogWidth * 0.28));
  const movieContentWidth = Math.max(150, catalogWidth - browserSidebarWidth - 42);
  const movieCardColumns = isWide ? (movieContentWidth >= 560 ? 4 : 3) : 2;
  const movieCardWidth = Math.max(68, (movieContentWidth - movieCardColumns * 10) / movieCardColumns);
  const posterHeight = Math.max(56, Math.min(height * 0.32, movieCardWidth * 1.25));
  const primaryTileHeight = compactHomeLayout ? Math.max(85, homeMenuHeight * 0.48) : homeMenuHeight;
  const secondaryTileHeight = compactHomeLayout
    ? Math.max(62, Math.min(90, (width - 80) / 4))
    : Math.max(54, (homeMenuHeight - 20) / 3);
  const pagePadding = Math.min(14, height * 0.025);
  const [form, setForm] = useState(initialForm);
  const [result, setResult] = useState<ActivationResult | null>(null);
  const [packages, setPackages] = useState<IptvPackage[]>([]);
  const [movieCategories, setMovieCategories] = useState<MovieCategory[]>([]);
  const [movieCategoriesLoading, setMovieCategoriesLoading] = useState(false);
  const [movieCategoriesLoaded, setMovieCategoriesLoaded] = useState(false);
  const [movieCategoriesError, setMovieCategoriesError] = useState('');
  const [expandedMovieCategory, setExpandedMovieCategory] = useState<string | null>(null);
  const [selectedMovieSubcategory, setSelectedMovieSubcategory] = useState<string | null>(null);
  const [seriesCategories, setSeriesCategories] = useState<MovieCategory[]>([]);
  const [seriesCategoriesLoading, setSeriesCategoriesLoading] = useState(false);
  const [seriesCategoriesLoaded, setSeriesCategoriesLoaded] = useState(false);
  const [seriesCategoriesError, setSeriesCategoriesError] = useState('');
  const [expandedSeriesCategory, setExpandedSeriesCategory] = useState<string | null>(null);
  const [selectedSeriesSubcategory, setSelectedSeriesSubcategory] = useState<string | null>(null);
  const [seriesItems, setSeriesItems] = useState<SeriesItem[]>([]);
  const [seriesItemsLoading, setSeriesItemsLoading] = useState(false);
  const [seriesItemsError, setSeriesItemsError] = useState('');
  const [selectedSeriesItem, setSelectedSeriesItem] = useState<SeriesItem | null>(null);
  const [seriesEpisodes, setSeriesEpisodes] = useState<SeriesEpisode[]>([]);
  const [seriesEpisodesLoading, setSeriesEpisodesLoading] = useState(false);
  const [seriesEpisodesError, setSeriesEpisodesError] = useState('');
  const [playingEpisode, setPlayingEpisode] = useState<SeriesEpisode | null>(null);
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [moviesLoading, setMoviesLoading] = useState(false);
  const [moviesError, setMoviesError] = useState('');
  const [selectedMovie, setSelectedMovie] = useState<MovieItem | null>(null);
  const [movieDetails, setMovieDetails] = useState<MovieInfo | null>(null);
  const [movieDetailsLoading, setMovieDetailsLoading] = useState(false);
  const [movieDetailsError, setMovieDetailsError] = useState('');
  const [playingMovie, setPlayingMovie] = useState<MovieInfo | null>(null);
  const [sportsChannels, setSportsChannels] = useState<SportsChannel[]>([]);
  const [sportsError, setSportsError] = useState('');
  const [sportsLoading, setSportsLoading] = useState(false);
  const [sportsLoaded, setSportsLoaded] = useState(false);
  const [sat2iptvChannels, setSat2iptvChannels] = useState<IptvChannel[]>([]);
  const [sat2iptvError, setSat2iptvError] = useState('');
  const [sat2iptvLoading, setSat2iptvLoading] = useState(false);
  const [sat2iptvLoaded, setSat2iptvLoaded] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<IptvPackage | null>(null);
  const [channels, setChannels] = useState<IptvChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<IptvChannel | null>(null);
  const [activeCategory, setActiveCategory] = useState<ContentCategory>('HOME');
  const [categoryHistory, setCategoryHistory] = useState<NavigationEntry[]>([{ category: 'HOME', kidsFilter: false }]);
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSection>('ADVANCED');
  const [kidsFilter, setKidsFilter] = useState(false);
  const [selectedSportsPackage, setSelectedSportsPackage] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [playbackError, setPlaybackError] = useState('');
  const [loading, setLoading] = useState(false);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [buttonFocused, setButtonFocused] = useState(false);
  const sportsRequestController = useRef<AbortController | null>(null);
  const player = useVideoPlayer(null);
  const activeMedia = selectedChannel ?? playingMovie ?? playingEpisode;
  const sportsPackageNames = Array.from(new Set(sportsChannels.map(({ packageName }) => packageName))).sort();
  const activeSeriesKeywords = kidsFilter && activeCategory === 'SERIES'
    ? kidsKeywords
    : seriesThemeKeywords[activeCategory];
  const visibleMovieCategories = kidsFilter
    ? movieCategories
      .map((category) => ({
        ...category,
        sub_cats: category.sub_cats.filter((subcategory) =>
          matchesKeywords(category.cat_name, kidsKeywords) || matchesKeywords(subcategory.sub_name, kidsKeywords)
        ),
      }))
      .filter((category) => matchesKeywords(category.cat_name, kidsKeywords) || category.sub_cats.length > 0)
    : movieCategories;
  const selectedMovieSubcategoryMatchesKids = kidsFilter && movieCategories.some((category) =>
    (matchesKeywords(category.cat_name, kidsKeywords) || category.sub_cats.some((subcategory) =>
      subcategory.sub_id === selectedMovieSubcategory && matchesKeywords(subcategory.sub_name, kidsKeywords)
    )) && category.sub_cats.some((subcategory) => subcategory.sub_id === selectedMovieSubcategory)
  );
  const visibleMovies = kidsFilter && !selectedMovieSubcategoryMatchesKids
    ? movies.filter((movie) => matchesKeywords(movie.title, kidsKeywords))
    : movies;
  const visibleSeriesCategories = activeSeriesKeywords
    ? seriesCategories
      .map((category) => ({
        ...category,
        sub_cats: category.sub_cats.filter((subcategory) =>
          matchesKeywords(category.cat_name, activeSeriesKeywords) ||
          matchesKeywords(subcategory.sub_name, activeSeriesKeywords)
        ),
      }))
      .filter((category) =>
        matchesKeywords(category.cat_name, activeSeriesKeywords) || category.sub_cats.length > 0
      )
    : seriesCategories;
  const selectedSeriesSubcategoryMatchesTheme = activeSeriesKeywords
    ? seriesCategories.some((category) =>
      (matchesKeywords(category.cat_name, activeSeriesKeywords) ||
        category.sub_cats.some((subcategory) =>
          subcategory.sub_id === selectedSeriesSubcategory &&
          matchesKeywords(subcategory.sub_name, activeSeriesKeywords)
        )) &&
      category.sub_cats.some((subcategory) => subcategory.sub_id === selectedSeriesSubcategory)
    )
    : false;
  const visibleSeriesItems = activeSeriesKeywords && !selectedSeriesSubcategoryMatchesTheme
    ? seriesItems.filter((item) => matchesKeywords(seriesTitle(item), activeSeriesKeywords))
    : seriesItems;
  const seriesSeasons = Array.from(new Set(seriesEpisodes.map((episode) => String(episode.season_num))))
    .sort((first, second) => Number(first) - Number(second));

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const [savedForm, savedSession] = await Promise.all([
          SecureStore.getItemAsync(storageKey),
          SecureStore.getItemAsync(sessionStorageKey),
        ]);
        const restoredForm: unknown = savedForm ? JSON.parse(savedForm) : null;
        const activationForm = isActivationForm(restoredForm) ? restoredForm : null;
        if (restoredForm && !activationForm) {
          throw new Error('بيانات الدخول المحفوظة غير صالحة. يرجى تسجيل الدخول مجددًا.');
        }
        if (cancelled) return;
        if (activationForm) setForm(activationForm);

        const restoredSession: unknown = savedSession ? JSON.parse(savedSession) : null;
        if (restoredSession && isSavedActivation(restoredSession) && activationForm) {
          setResult(restoredSession);
          setActiveCategory('HOME');
          setCategoryHistory([{ category: 'HOME', kidsFilter: false }]);
          setPackagesLoading(true);
          setSessionLoading(false);

          try {
            const data = await requestServer({
              mode: 'lite_packages',
              code: activationForm.code.trim(),
              mac: activationForm.mac.trim() || '00:00:00:00:00:00',
              sn: activationForm.sn.trim() || '000000000000',
              chipid: activationForm.chipid.trim(),
              model: activationForm.model.trim() || '2000plus',
              firmware_ver: activationForm.firmware_ver.trim() || '1.2',
            });
            if (!isPackageList(data)) throw new Error('صيغة قائمة الباقات غير متوقعة.');
            if (!cancelled) setPackages(data);
          } catch (restoreError) {
            if (!cancelled) setCatalogError(restoreError instanceof Error ? restoreError.message : 'تعذر تحميل الباقات.');
          } finally {
            if (!cancelled) setPackagesLoading(false);
          }
        } else if (savedSession) {
          await SecureStore.deleteItemAsync(sessionStorageKey);
        }
      } catch (restoreError) {
        if (!cancelled) setError(restoreError instanceof Error ? restoreError.message : 'تعذر استعادة جلسة الدخول المحفوظة.');
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    }

    void restoreSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => SplashScreen.hide(), 3_000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!activeMedia) {
      player.pause();
      return;
    }

    let cancelled = false;
    setPlaybackError('');
    player.replaceAsync({
      uri: activeMedia.stream_url,
      headers: result?.user_agent ? { 'User-Agent': result.user_agent } : undefined,
    }).then(() => {
      if (!cancelled) player.play();
    }).catch(() => {
      if (!cancelled) setPlaybackError('تعذر تشغيل القناة. تحقق من رابط البث أو توافقه مع المشغل.');
    });

    return () => {
      cancelled = true;
      player.pause();
    };
  }, [activeMedia, player, result?.user_agent]);

  function updateField(field: keyof ActivationForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function deviceFields() {
    return {
      code: form.code.trim(),
      mac: form.mac.trim() || '00:00:00:00:00:00',
      sn: form.sn.trim() || '000000000000',
      chipid: form.chipid.trim(),
      model: form.model.trim() || '2000plus',
      firmware_ver: form.firmware_ver.trim() || '1.2',
    };
  }

  async function requestServer(payload: Record<string, string>, signal?: AbortSignal) {
    if (!xorKey) {
      throw new Error('مفتاح XOR غير مهيأ. يرجى إعداد EXPO_PUBLIC_XOR_KEY في ملف android/.env.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const abortRequest = () => controller.abort();

    if (signal?.aborted) {
      controller.abort();
    } else {
      signal?.addEventListener('abort', abortRequest, { once: true });
    }

    try {
      const form = new FormData();
      form.append('json', encodeXorBase64(payload, xorKey));
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'user-agent': `REV ${payload.model} ${payload.firmware_ver}`.replace(/[\r\n]/g, ''),
        },
        body: form,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Server is down, please try again later.');
      }

      try {
        return decodeXorJson(new Uint8Array(await response.arrayBuffer()), xorKey);
      } catch {
        throw new Error('Server is down, please try again later.');
      }
    } catch (requestError) {
      if (controller.signal.aborted) {
        throw new Error('Server is down, please try again later.');
      }
      if (requestError instanceof TypeError) {
        throw new Error('Server is down, please try again later.');
      }
      throw requestError;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abortRequest);
    }
  }

  function isPackageList(value: unknown): value is IptvPackage[] {
    return Array.isArray(value) && value.every((item) =>
      item && typeof item.id === 'string' && typeof item.pkg_name === 'string'
    );
  }

  function normalizeChannelList(value: unknown): IptvChannel[] | null {
    if (!Array.isArray(value)) return null;

    const channels: IptvChannel[] = [];
    for (const item of value) {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) return null;
      const channel = item as Record<string, unknown>;
      const channelName = typeof channel.channel_name === 'string'
        ? channel.channel_name
        : typeof channel.stream_display_name === 'string'
          ? channel.stream_display_name
          : '';
      if (!channelName.trim() || typeof channel.stream_url !== 'string' || !channel.stream_url.trim()) return null;

      channels.push({
        channel_name: channelName.trim(),
        stream_url: channel.stream_url,
        stream_icon: typeof channel.stream_icon === 'string' ? channel.stream_icon : undefined,
        angle: typeof channel.angle === 'string' ? channel.angle : undefined,
        tp: typeof channel.tp === 'string' || typeof channel.tp === 'number' ? channel.tp : null,
        pol: typeof channel.pol === 'string' ? channel.pol : undefined,
        sid: typeof channel.sid === 'string' || typeof channel.sid === 'number' ? channel.sid : null,
      });
    }
    return channels;
  }

  function isMovieCategoryList(value: unknown): value is MovieCategory[] {
    return Array.isArray(value) && value.every((item) =>
      item && typeof item.cat_id === 'string' && typeof item.cat_name === 'string' &&
      Array.isArray(item.sub_cats) && item.sub_cats.every((subcategory: unknown) =>
        typeof subcategory === 'object' && subcategory !== null &&
        'sub_id' in subcategory && typeof subcategory.sub_id === 'string' &&
        'sub_name' in subcategory && typeof subcategory.sub_name === 'string'
      )
    );
  }

  function isMovieList(value: unknown): value is MovieItem[] {
    return Array.isArray(value) && value.every((item) =>
      item && typeof item.id === 'string' && typeof item.title === 'string' &&
      typeof item.catid === 'string' && typeof item.stream_url === 'string'
    );
  }

  function isMovieInfoList(value: unknown): value is MovieInfo[] {
    return Array.isArray(value) && value.every((item) =>
      item && typeof item.id === 'string' && typeof item.stream_display_name === 'string' &&
      typeof item.stream_url === 'string'
    );
  }

  function isSeriesList(value: unknown): value is SeriesItem[] {
    return Array.isArray(value) && value.every((item) =>
      typeof item === 'object' && item !== null && !Array.isArray(item) &&
      'id' in item && (typeof item.id === 'string' || typeof item.id === 'number') &&
      'title' in item && typeof item.title === 'string'
    );
  }

  function isSeriesEpisodeList(value: unknown): value is SeriesEpisode[] {
    return Array.isArray(value) && value.every((item) =>
      item && (typeof item.season_num === 'string' || typeof item.season_num === 'number') &&
      (typeof item.episode_num === 'string' || typeof item.episode_num === 'number') &&
      typeof item.episode_name === 'string' && typeof item.stream_url === 'string'
    );
  }

  function seriesId(item: SeriesItem) {
    const id = item.series_id ?? item.id ?? item.id_series;
    return typeof id === 'string' || typeof id === 'number' ? String(id) : '';
  }

  function seriesTitle(item: SeriesItem) {
    for (const field of ['series_name', 'name', 'title', 'stream_display_name']) {
      if (typeof item[field] === 'string' && item[field].trim()) return item[field].trim();
    }
    return 'مسلسل';
  }

  function seriesOrder(item: SeriesItem) {
    const order = item.view_order ?? item.series_view_order;
    return typeof order === 'number' || typeof order === 'string' ? Number(order) || 0 : 0;
  }

  function seriesValue(item: SeriesItem, field: string) {
    return typeof item[field] === 'string' ? item[field].trim() : '';
  }

  function seriesPoster(item: SeriesItem) {
    const uri = seriesValue(item, 'icon_big') || seriesValue(item, 'icon');
    return uri.startsWith('https://') ? uri : '';
  }

  function isSportsPackage(value: string) {
    return /sports?/i.test(value);
  }

  async function activate() {
    setError('');
    setResult(null);
    setActiveCategory('HOME');
    setCategoryHistory([{ category: 'HOME', kidsFilter: false }]);
    setKidsFilter(false);
    setSelectedSportsPackage(null);
    setSessionLoading(false);
    setPackages([]);
    setMovieCategories([]);
    setMovieCategoriesLoading(false);
    setMovieCategoriesLoaded(false);
    setMovieCategoriesError('');
    setExpandedMovieCategory(null);
    setSelectedMovieSubcategory(null);
    setSeriesCategories([]);
    setSeriesCategoriesLoading(false);
    setSeriesCategoriesLoaded(false);
    setSeriesCategoriesError('');
    setExpandedSeriesCategory(null);
    setSelectedSeriesSubcategory(null);
    setSeriesItems([]);
    setSeriesItemsError('');
    setSelectedSeriesItem(null);
    setSeriesEpisodes([]);
    setSeriesEpisodesError('');
    setPlayingEpisode(null);
    setMovies([]);
    setMoviesError('');
    setSelectedMovie(null);
    setMovieDetails(null);
    setMovieDetailsError('');
    setPlayingMovie(null);
    setSportsChannels([]);
    setSportsError('');
    setSportsLoaded(false);
    setSat2iptvChannels([]);
    setSat2iptvError('');
    setSat2iptvLoaded(false);
    setSelectedPackage(null);
    setChannels([]);
    setSelectedChannel(null);
    setNotice(null);
    setCatalogError('');

    if (!form.code.trim()) {
      setError('Enter the activation code to continue.');
      return;
    }
    setLoading(true);
    try {
      await SecureStore.deleteItemAsync(sessionStorageKey);
      await SecureStore.setItemAsync(storageKey, JSON.stringify(form));
      const data = await requestServer({ mode: 'active', ...deviceFields() }) as ActivationResult;

      setResult(data);
      const detail = [data.expire ? `الصلاحية: ${data.expire}` : '', data.osd?.trim() || '']
        .filter(Boolean)
        .join('\n');

      if (data.status === 100) {
        await SecureStore.setItemAsync(sessionStorageKey, JSON.stringify(data));
        setNotice({ title: data.message || 'تم تفعيل الجهاز', detail });
        setPackagesLoading(true);
        try {
          const packageData = await requestServer({ mode: 'lite_packages', ...deviceFields() });
          if (!isPackageList(packageData)) throw new Error('صيغة قائمة الباقات غير متوقعة.');
          setPackages(packageData);
        } catch (packageError) {
          setCatalogError(packageError instanceof Error ? packageError.message : 'تعذر تحميل الباقات.');
        } finally {
          setPackagesLoading(false);
        }
      } else {
        setNotice({ title: data.message || 'تعذر تفعيل الجهاز', detail: data.osd?.trim() || undefined });
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'حدث خطأ غير متوقع.';
      setError(message);
      setNotice({ title: message });
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await SecureStore.deleteItemAsync(storageKey);
      await SecureStore.deleteItemAsync(sessionStorageKey);
      setForm(initialForm);
      setResult(null);
      setActiveCategory('HOME');
      setCategoryHistory([{ category: 'HOME', kidsFilter: false }]);
      setKidsFilter(false);
      setPackages([]);
      setSelectedPackage(null);
      setChannels([]);
      setSelectedChannel(null);
      setSelectedSportsPackage(null);
      setSat2iptvChannels([]);
      setSat2iptvError('');
      setSat2iptvLoaded(false);
      setPlayingMovie(null);
      setPlayingEpisode(null);
      setSeriesItems([]);
      setSeriesEpisodes([]);
      setSelectedSeriesItem(null);
      setSelectedMovie(null);
      setMovieDetails(null);
      setNotice(null);
      setError('');
      setCatalogError('');
    } catch {
      setError('تعذر حذف بيانات الجلسة من هذا الجهاز.');
    }
  }

  async function choosePackage(item: IptvPackage) {
    setSelectedPackage(item);
    setChannels([]);
    setSelectedChannel(null);
    setCatalogError('');
    setChannelsLoading(true);

    try {
      const channelData = await requestServer({
        mode: 'lite_channels',
        ...deviceFields(),
        pkg_id: item.id,
      });
      const normalizedChannels = normalizeChannelList(channelData);
      if (!normalizedChannels) throw new Error('صيغة قائمة القنوات غير متوقعة.');
      setChannels(normalizedChannels);
    } catch (channelError) {
      setCatalogError(channelError instanceof Error ? channelError.message : 'تعذر تحميل القنوات.');
    } finally {
      setChannelsLoading(false);
    }
  }

  async function loadMovieCategories() {
    if (movieCategoriesLoaded || movieCategoriesLoading) return;

    setMovieCategoriesLoading(true);
    setMovieCategoriesError('');
    try {
      const data = await requestServer({ mode: 'movies_cat', ...deviceFields() });
      if (!isMovieCategoryList(data)) throw new Error('صيغة تصنيفات الأفلام غير متوقعة.');

      const sortedCategories = data
        .map((category) => ({
          ...category,
          sub_cats: [...category.sub_cats].sort((first, second) =>
            Number(first.sub_view_order || 0) - Number(second.sub_view_order || 0)
          ),
        }))
        .sort((first, second) => Number(first.cat_view_order || 0) - Number(second.cat_view_order || 0));

      setMovieCategories(sortedCategories);
      setMovieCategoriesLoaded(true);
    } catch (categoryError) {
      setMovieCategoriesError(categoryError instanceof Error ? categoryError.message : 'تعذر تحميل تصنيفات الأفلام.');
    } finally {
      setMovieCategoriesLoading(false);
    }
  }

  async function loadSeriesCategories() {
    if (seriesCategoriesLoaded || seriesCategoriesLoading) return;

    setSeriesCategoriesLoading(true);
    setSeriesCategoriesError('');
    try {
      const data = await requestServer({ mode: 'series_cat', ...deviceFields() });
      if (!isMovieCategoryList(data)) throw new Error('صيغة تصنيفات المسلسلات غير متوقعة.');

      const sortedCategories = data
        .map((category) => ({
          ...category,
          sub_cats: [...category.sub_cats].sort((first, second) =>
            Number(first.sub_view_order || 0) - Number(second.sub_view_order || 0)
          ),
        }))
        .sort((first, second) => Number(first.cat_view_order || 0) - Number(second.cat_view_order || 0));

      setSeriesCategories(sortedCategories);
      setSeriesCategoriesLoaded(true);
    } catch (categoryError) {
      setSeriesCategoriesError(categoryError instanceof Error ? categoryError.message : 'تعذر تحميل تصنيفات المسلسلات.');
    } finally {
      setSeriesCategoriesLoading(false);
    }
  }

  async function loadSeries(subcategory: MovieSubcategory) {
    setSelectedSeriesSubcategory(subcategory.sub_id);
    setSeriesItems([]);
    setSeriesItemsError('');
    setSelectedSeriesItem(null);
    setSeriesEpisodes([]);
    setSeriesEpisodesError('');
    setPlayingEpisode(null);
    setSeriesItemsLoading(true);

    try {
      const data = await requestServer({
        mode: 'series_list',
        ...deviceFields(),
        catid: subcategory.sub_id,
      });
      if (!isSeriesList(data)) throw new Error('صيغة قائمة المسلسلات غير متوقعة.');
      setSeriesItems([...data].sort((first, second) => seriesOrder(first) - seriesOrder(second)));
    } catch (seriesError) {
      setSeriesItemsError(seriesError instanceof Error ? seriesError.message : 'تعذر تحميل المسلسلات.');
    } finally {
      setSeriesItemsLoading(false);
    }
  }

  async function loadSeriesEpisodes(item: SeriesItem) {
    const id = seriesId(item);
    if (!id) {
      setSeriesEpisodesError('لم يعرض الخادم معرّف هذا المسلسل.');
      return;
    }

    setSelectedSeriesItem(item);
    setSelectedChannel(null);
    setSeriesEpisodes([]);
    setSeriesEpisodesError('');
    setPlayingEpisode(null);
    setSeriesEpisodesLoading(true);

    try {
      const data = await requestServer({
        mode: 'series_info',
        ...deviceFields(),
        series_id: id,
      });
      if (!isSeriesEpisodeList(data)) throw new Error('صيغة حلقات المسلسل غير متوقعة.');
      setSeriesEpisodes([...data].sort((first, second) =>
        Number(first.season_num) - Number(second.season_num) || Number(first.episode_num) - Number(second.episode_num)
      ));
    } catch (episodeError) {
      setSeriesEpisodesError(episodeError instanceof Error ? episodeError.message : 'تعذر تحميل الحلقات.');
    } finally {
      setSeriesEpisodesLoading(false);
    }
  }

  async function loadMovies(subcategory: MovieSubcategory) {
    setSelectedMovieSubcategory(subcategory.sub_id);
    setMovies([]);
    setMoviesError('');
    setSelectedMovie(null);
    setMovieDetails(null);
    setMovieDetailsError('');
    setPlayingMovie(null);
    setMoviesLoading(true);

    try {
      const data = await requestServer({
        mode: 'movies_list',
        ...deviceFields(),
        catid: subcategory.sub_id,
      });
      if (!isMovieList(data)) throw new Error('صيغة قائمة الأفلام غير متوقعة.');
      setMovies([...data].sort((first, second) => Number(first.view_order || 0) - Number(second.view_order || 0)));
    } catch (movieListError) {
      setMoviesError(movieListError instanceof Error ? movieListError.message : 'تعذر تحميل الأفلام.');
    } finally {
      setMoviesLoading(false);
    }
  }

  async function loadMovieDetails(movie: MovieItem) {
    setSelectedMovie(movie);
    setSelectedChannel(null);
    setMovieDetails(null);
    setMovieDetailsError('');
    setPlayingMovie(null);
    setMovieDetailsLoading(true);

    try {
      const data = await requestServer({
        mode: 'movies_info',
        ...deviceFields(),
        movie_id: movie.id,
      });
      if (!isMovieInfoList(data) || !data[0]) throw new Error('لم يعثر الخادم على تفاصيل هذا الفيلم.');
      setMovieDetails(data[0]);
    } catch (movieInfoError) {
      setMovieDetailsError(movieInfoError instanceof Error ? movieInfoError.message : 'تعذر تحميل تفاصيل الفيلم.');
    } finally {
      setMovieDetailsLoading(false);
    }
  }

  async function loadSportsChannels() {
    if (sportsLoaded || packagesLoading || packages.length === 0) return;

    sportsRequestController.current?.abort();
    const controller = new AbortController();
    sportsRequestController.current = controller;
    setSportsChannels([]);
    setSportsError('');
    setSportsLoading(true);
    const matches = new Map<string, SportsChannel>();
    const sportsPackages = packages.filter((item) => isSportsPackage(item.pkg_name));

    try {
      for (const item of sportsPackages) {
        const data = await requestServer({
          mode: 'lite_channels',
          ...deviceFields(),
          pkg_id: item.id,
        }, controller.signal);
        const channels = normalizeChannelList(data);
        if (!channels) throw new Error(`صيغة قنوات باقة ${item.pkg_name} غير متوقعة.`);

        for (const channel of channels) {
          matches.set(channel.stream_url, { channel, packageName: item.pkg_name });
        }

        if (!controller.signal.aborted) setSportsChannels(Array.from(matches.values()));
      }

      if (!controller.signal.aborted) setSportsLoaded(true);
    } catch (sportsRequestError) {
      if (!controller.signal.aborted) {
        setSportsError(sportsRequestError instanceof Error ? sportsRequestError.message : 'تعذر تحميل القنوات الرياضية.');
      }
    } finally {
      if (sportsRequestController.current === controller) {
        sportsRequestController.current = null;
        setSportsLoading(false);
      }
    }
  }

  async function loadSat2iptvChannels() {
    if (sat2iptvLoaded || sat2iptvLoading) return;

    setSat2iptvLoading(true);
    setSat2iptvError('');

    try {
      const data = await requestServer({ mode: 'sat2iptv', ...deviceFields() });
      const channels = normalizeChannelList(data);
      if (!channels) throw new Error('صيغة قائمة قنوات SAT إلى IPTV غير متوقعة.');
      setSat2iptvChannels(channels);
      setSat2iptvLoaded(true);
    } catch (sat2iptvRequestError) {
      setSat2iptvError(sat2iptvRequestError instanceof Error ? sat2iptvRequestError.message : 'تعذر تحميل قنوات SAT إلى IPTV.');
    } finally {
      setSat2iptvLoading(false);
    }
  }

  function navigateCategory(category: ContentCategory, filterKids = false) {
    setCategoryHistory((history) => [...history, { category, kidsFilter: filterKids }]);
    setActiveCategory(category);
    setKidsFilter(filterKids);
    setSelectedSportsPackage(null);
    setActiveSettingsSection('ADVANCED');
    setSelectedChannel(null);
    setSelectedPackage(null);
    setChannels([]);
    setPlayingMovie(null);
    setPlayingEpisode(null);
  }

  function handleSystemBack() {
    if (activeCategory === 'SETTINGS' && activeSettingsSection !== 'ADVANCED') {
      setActiveSettingsSection('ADVANCED');
      return true;
    }
    if (playingMovie) {
      setPlayingMovie(null);
      return true;
    }
    if (movieDetails || selectedMovie) {
      setMovieDetails(null);
      setSelectedMovie(null);
      setMovieDetailsError('');
      return true;
    }
    if (selectedMovieSubcategory) {
      setSelectedMovieSubcategory(null);
      setMovies([]);
      setMoviesError('');
      return true;
    }
    if (expandedMovieCategory) {
      setExpandedMovieCategory(null);
      return true;
    }
    if (playingEpisode) {
      setPlayingEpisode(null);
      return true;
    }
    if (selectedSeriesItem) {
      setSelectedSeriesItem(null);
      setSeriesEpisodes([]);
      setSeriesEpisodesError('');
      return true;
    }
    if (selectedSeriesSubcategory) {
      setSelectedSeriesSubcategory(null);
      setSeriesItems([]);
      setSeriesItemsError('');
      setSelectedSeriesItem(null);
      setSeriesEpisodes([]);
      return true;
    }
    if (expandedSeriesCategory) {
      setExpandedSeriesCategory(null);
      return true;
    }
    if (selectedChannel) {
      setSelectedChannel(null);
      return true;
    }
    if (activeCategory === 'SPORTS' && selectedSportsPackage) {
      setSelectedSportsPackage(null);
      return true;
    }
    if (selectedPackage) {
      setSelectedPackage(null);
      setChannels([]);
      return true;
    }
    if (categoryHistory.length > 1) {
      const previous = categoryHistory[categoryHistory.length - 2];
      setCategoryHistory((history) => history.slice(0, -1));
      setActiveCategory(previous.category);
      setKidsFilter(previous.kidsFilter);
      setActiveSettingsSection('ADVANCED');
      return true;
    }
    return false;
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleSystemBack);
    return () => subscription.remove();
  }, [
    activeCategory,
    activeSettingsSection,
    categoryHistory,
    movieDetails,
    playingEpisode,
    playingMovie,
    selectedChannel,
    expandedMovieCategory,
    expandedSeriesCategory,
    selectedMovie,
    selectedMovieSubcategory,
    selectedPackage,
    selectedSeriesItem,
    selectedSeriesSubcategory,
    selectedSportsPackage,
  ]);

  function selectCategory(category: ContentCategory) {
    navigateCategory(category);
    if (category !== 'LIVE' && category !== 'SPORTS' && category !== 'SAT2IPTV') setSelectedChannel(null);
    if (category !== 'MOVIES') setPlayingMovie(null);
    if (category !== 'SERIES') setPlayingEpisode(null);
    if (category !== 'SPORTS') {
      sportsRequestController.current?.abort();
      sportsRequestController.current = null;
      setSportsLoading(false);
    }
    if (category === 'SPORTS') {
      void loadSportsChannels();
    } else if (category === 'SAT2IPTV') {
      void loadSat2iptvChannels();
    } else if (category === 'MOVIES') {
      void loadMovieCategories();
    } else if (category === 'SERIES' || seriesThemeKeywords[category]) {
      void loadSeriesCategories();
    }
  }

  function selectKidsCatalog(category: 'MOVIES' | 'SERIES') {
    navigateCategory(category, true);
    setSelectedMovieSubcategory(null);
    setSelectedSeriesSubcategory(null);
    setSelectedSeriesItem(null);
    setSelectedMovie(null);
    setMovieDetails(null);
    setPlayingMovie(null);
    setPlayingEpisode(null);
    if (category === 'MOVIES') {
      void loadMovieCategories();
    } else {
      void loadSeriesCategories();
    }
  }

  const activated = result?.status === 100;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.page, { minHeight: height, paddingVertical: pagePadding, paddingBottom: pagePadding + 26 }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.content, isWide && styles.contentWide]}>
          {!activated && !sessionLoading ? (
            <View style={styles.loginBrand}>
              <Image source={require('./assets/galaxy-logo-transparent.png')} resizeMode="contain" style={styles.loginLogo} />
            </View>
          ) : activeCategory !== 'HOME' ? (
            <View style={styles.header}>
              <View style={styles.brandMark}><Text style={styles.brandGlyph}>G</Text></View>
              <View style={styles.liveTag}><View style={styles.liveDot} /><Text style={styles.liveText}>CONNECT</Text></View>
            </View>
          ) : null}

          {sessionLoading ? <ActivityIndicator color={colors.lime} style={styles.catalogLoader} /> : null}

          {activated ? (
            <View style={styles.headingBlock}>
              {activeCategory !== 'HOME' ? <Text style={styles.kicker}>بوابة المشاهدة</Text> : null}
              <Text style={styles.title}>{activeCategory === 'SETTINGS' ? 'الإعدادات' : activeCategory === 'HOME' ? 'GALAXY' : activeCategory === 'KIDS' ? 'kids' : activeCategory === 'QURAN' ? 'quran' : activeCategory === 'RAMADAN' ? 'ramadan' : 'اختر القسم'}</Text>
              <Text style={styles.subtitle}>{activeCategory === 'SETTINGS' ? 'تعديل بيانات الاتصال وإعادة التفعيل.' : activeCategory === 'HOME' ? 'اختر ما تريد مشاهدته' : activeCategory === 'KIDS' ? 'اختر أفلام الأطفال أو مسلسلات الأطفال.' : 'لايف، رياضة، أفلام ومسلسلات.'}</Text>
            </View>
          ) : null}

          <View style={[styles.form, activated && activeCategory !== 'SETTINGS' && styles.catalogForm]}>
            {!activated && !sessionLoading ? (
              <>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>{activated ? 'بيانات الاتصال' : 'Connection details'}</Text>
                  <View style={styles.sectionRule} />
                </View>

                <FormField
                  placeholder="ENTER ACTIVATION CODE"
                  value={form.code}
                  onChangeText={(value) => updateField('code', value.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                />

                <Pressable
                  accessibilityRole="button"
                  focusable
                  onBlur={() => setButtonFocused(false)}
                  onFocus={() => setButtonFocused(true)}
                  onPress={activate}
                  style={[styles.button, buttonFocused && styles.buttonFocused, loading && styles.buttonDisabled]}
                >
                  {loading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.buttonText}>{activated ? 'حفظ وإعادة الاتصال' : 'Verify activation'}</Text>}
                  {!loading && <Text style={styles.buttonArrow}>←</Text>}
                </Pressable>
              </>
            ) : null}

            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

            {result && !activated ? (
              <View style={[styles.result, activated ? styles.resultSuccess : styles.resultFailure]}>
                <View style={styles.resultTop}>
                  <View style={[styles.resultDot, activated ? styles.resultDotSuccess : styles.resultDotFailure]} />
                  <Text style={styles.resultTitle}>{result.message || result.error || 'استجابة الخادم'}</Text>
                  <Text style={styles.resultCode}>{result.status ?? '—'}</Text>
                </View>
                {result.expire ? <View style={styles.detailRow}><Text style={styles.detailValue}>{result.expire}</Text><Text style={styles.detailLabel}>الصلاحية</Text></View> : null}
                {result.code_id ? <View style={styles.detailRow}><Text style={styles.detailValue}>{result.code_id}</Text><Text style={styles.detailLabel}>رقم التفعيل</Text></View> : null}
                {result.user_agent ? <View style={styles.detailRow}><Text style={styles.detailValue}>{result.user_agent}</Text><Text style={styles.detailLabel}>مشغّل الوسائط</Text></View> : null}
                {result.osd?.trim() ? <Text style={styles.osd}>{result.osd}</Text> : null}
              </View>
            ) : null}

            {activated ? (
              <View style={styles.catalog}>
                {activeCategory === 'HOME' ? (
                  <View style={[styles.homeMenu, compactHomeLayout && styles.homeMenuCompact, { minHeight: compactHomeLayout ? undefined : homeMenuHeight }]}>
                    <View style={[styles.homePrimaryTiles, compactHomeLayout && styles.homePrimaryTilesCompact]}>
                      {homePrimaryTiles.map((tile) => (
                        <Pressable
                          key={tile.id}
                          accessibilityRole="button"
                          focusable
                          onPress={() => selectCategory(tile.id)}
                          style={[styles.homeTile, styles.homePrimaryTile, compactHomeLayout && styles.homePrimaryTileCompact, { minHeight: primaryTileHeight, borderColor: tile.accent, shadowColor: tile.accent }]}
                        >
                          <Text style={[styles.homePrimaryIcon, { color: tile.accent }]}>{tile.icon}</Text>
                          <Text style={[styles.homePrimaryLabel, { color: tile.accent }]}>{tile.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <View style={[styles.homeSecondaryTiles, compactHomeLayout && styles.homeSecondaryTilesCompact]}>
                      {homeSecondaryTiles.map((tile) => (
                        <Pressable
                          key={tile.id}
                          accessibilityRole="button"
                          focusable
                          onPress={() => selectCategory(tile.id)}
                          style={[styles.homeTile, styles.homeSecondaryTile, { minHeight: secondaryTileHeight, borderColor: tile.accent, shadowColor: tile.accent }]}
                        >
                          <Text style={[styles.homeSecondaryIcon, { color: tile.accent }]}>{tile.icon}</Text>
                          <Text style={[styles.homeSecondaryLabel, { color: tile.accent }]}>{tile.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : (
                  <>
                <View style={[
                  styles.catalogEmpty,
                  (activeCategory === 'MOVIES' || activeCategory === 'SERIES' || activeCategory === 'LIVE' || activeCategory === 'SPORTS') && styles.browserCatalog,
                ]}>
                  <Text style={styles.catalogTitle}>{contentCategories.find((category) => category.id === activeCategory)?.title}</Text>
                  {activeCategory === 'KIDS' ? (
                    <View style={styles.kidsSources}>
                      <Pressable accessibilityRole="button" focusable onPress={() => selectKidsCatalog('MOVIES')} style={styles.kidsSourceButton}>
                        <Text style={styles.kidsSourceLabel}>أفلام كيدز</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" focusable onPress={() => selectKidsCatalog('SERIES')} style={styles.kidsSourceButton}>
                        <Text style={styles.kidsSourceLabel}>مسلسلات كيدز</Text>
                      </Pressable>
                    </View>
                  ) : activeCategory === 'LIVE' ? (
                    <>
                      {packagesLoading ? <ActivityIndicator color={colors.lime} style={styles.catalogLoader} /> : null}
                      {catalogError ? <Text accessibilityRole="alert" style={styles.catalogError}>{catalogError}</Text> : null}
                      <View style={[styles.liveBrowser, !isWide && styles.browserStacked]}>
                        <View style={[styles.liveSidebar, !isWide && styles.browserSidebarCompact]}>
                          <Text style={styles.browserHeading}>الباقات</Text>
                          {packages.map((item) => (
                            <Pressable
                              key={item.id}
                              accessibilityRole="button"
                              focusable
                              onPress={() => choosePackage(item)}
                              style={[styles.browserCategory, selectedPackage?.id === item.id && styles.browserCategorySelected]}
                            >
                              <Text style={styles.browserCategoryText}>{item.pkg_name}</Text>
                              <Text style={styles.packageId}>{item.id}</Text>
                            </Pressable>
                          ))}
                        </View>
                        <View style={[styles.liveContent, !isWide && styles.browserContentCompact]}>
                          {selectedPackage ? (
                            <>
                              <Text style={styles.channelHeading}>{selectedPackage.pkg_name}</Text>
                              {channelsLoading ? <ActivityIndicator color={colors.lime} style={styles.catalogLoader} /> : null}
                              {!channelsLoading && channels.length === 0 && !catalogError ? <Text style={styles.catalogMessage}>لا توجد قنوات في هذه الباقة.</Text> : null}
                              {channels.map((channel, index) => (
                                <Pressable
                                  key={`${channel.stream_url}-${index}`}
                                  accessibilityRole="button"
                                  focusable
                                  onPress={() => setSelectedChannel(channel)}
                                  style={[styles.channelRow, selectedChannel?.stream_url === channel.stream_url && styles.packageRowSelected]}
                                >
                                  <Text style={styles.channelName}>{channel.channel_name}</Text>
                                  {channel.angle ? <Text style={styles.channelMeta}>{channel.angle}</Text> : null}
                                </Pressable>
                              ))}
                            </>
                          ) : <Text style={styles.catalogMessage}>اختر باقة لعرض القنوات.</Text>}
                          {selectedChannel ? (
                            <View style={styles.playerSection}>
                              <Text style={styles.channelHeading}>{selectedChannel.channel_name}</Text>
                              <VideoView player={player} nativeControls contentFit="contain" style={styles.video} />
                              {playbackError ? <Text accessibilityRole="alert" style={styles.catalogError}>{playbackError}</Text> : null}
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </>
                  ) : activeCategory === 'MOVIES' ? (
                    <>
                      {movieCategoriesLoading ? <ActivityIndicator color={colors.lime} style={styles.catalogLoader} /> : null}
                      {movieCategoriesError ? <Text accessibilityRole="alert" style={styles.catalogError}>{movieCategoriesError}</Text> : null}
                      {!movieCategoriesLoading && !movieCategoriesError && movieCategoriesLoaded && visibleMovieCategories.length === 0 ? <Text style={styles.catalogMessage}>{kidsFilter ? 'لم يتم العثور على تصنيفات أفلام أطفال.' : 'لا توجد تصنيفات للأفلام.'}</Text> : null}
                      <View style={[styles.movieBrowser, !isWide && styles.browserStacked]}>
                        <ScrollView style={[styles.movieSidebar, !isWide && styles.browserSidebarCompact]} nestedScrollEnabled>
                          {visibleMovieCategories.map((category) => (
                            <View key={category.cat_id} style={styles.movieCategory}>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityState={{ expanded: expandedMovieCategory === category.cat_id }}
                                focusable
                                onPress={() => setExpandedMovieCategory((current) => current === category.cat_id ? null : category.cat_id)}
                                style={[styles.browserCategory, expandedMovieCategory === category.cat_id && styles.browserCategorySelected]}
                              >
                                <Text style={styles.browserCategoryText}>{category.cat_name.trim()}</Text>
                                <Text style={styles.packageId}>{category.sub_cats.length}</Text>
                              </Pressable>
                              {expandedMovieCategory === category.cat_id ? category.sub_cats
                                .filter((subcategory) =>
                                  !kidsFilter || matchesKeywords(category.cat_name, kidsKeywords) || matchesKeywords(subcategory.sub_name, kidsKeywords)
                                )
                                .map((subcategory) => (
                                  <Pressable
                                    key={subcategory.sub_id}
                                    accessibilityRole="button"
                                    focusable
                                    onPress={() => void loadMovies(subcategory)}
                                    style={[styles.browserSubcategory, selectedMovieSubcategory === subcategory.sub_id && styles.browserCategorySelected]}
                                  >
                                    <Text style={styles.browserCategoryText}>{subcategory.sub_name.trim()}</Text>
                                  </Pressable>
                                )) : null}
                            </View>
                          ))}
                        </ScrollView>
                        <View style={[styles.movieContent, !isWide && styles.browserContentCompact]}>
                          {selectedMovieSubcategory ? (
                            <>
                          {moviesLoading ? <ActivityIndicator color={colors.lime} style={styles.catalogLoader} /> : null}
                          {moviesError ? <Text accessibilityRole="alert" style={styles.catalogError}>{moviesError}</Text> : null}
                          {!moviesLoading && !moviesError && visibleMovies.length === 0 ? <Text style={styles.catalogMessage}>{kidsFilter ? 'لا توجد أفلام أطفال مطابقة.' : 'لا توجد أفلام في هذا التصنيف.'}</Text> : null}
                          <View style={styles.posterGrid}>
                            {visibleMovies.map((movie) => (
                              <Pressable
                                key={movie.id}
                                accessibilityRole="button"
                                onPress={() => void loadMovieDetails(movie)}
                                focusable
                                style={[styles.posterCard, selectedMovie?.id === movie.id && styles.posterCardSelected, { width: movieCardWidth, minHeight: posterHeight + 38 }]}
                              >
                                {movie.icon ? <Image source={{ uri: movie.icon }} resizeMode="cover" style={[styles.posterImage, { height: posterHeight }]} /> : <View style={[styles.posterPlaceholder, { height: posterHeight }]}><Text style={styles.posterPlaceholderText}>{movie.title.slice(0, 2)}</Text></View>}
                                <Text numberOfLines={2} style={styles.posterTitle}>{movie.title}</Text>
                              </Pressable>
                            ))}
                          </View>
                          {movieDetailsLoading ? <ActivityIndicator color={colors.lime} style={styles.catalogLoader} /> : null}
                          {movieDetailsError ? <Text accessibilityRole="alert" style={styles.catalogError}>{movieDetailsError}</Text> : null}
                          {movieDetails ? (
                            <View style={styles.movieDetails}>
                              {(movieDetails.stream_icon || movieDetails.movie_image || selectedMovie?.icon) ? (
                                <Image
                                  source={{ uri: movieDetails.stream_icon || movieDetails.movie_image || selectedMovie?.icon }}
                                  resizeMode="cover"
                                  style={styles.moviePoster}
                                />
                              ) : null}
                              <Text style={styles.movieDetailsTitle}>{movieDetails.stream_display_name}</Text>
                              {movieDetails.genre ? <Text style={styles.movieMeta}>{movieDetails.genre}</Text> : null}
                              {movieDetails.duration ? <Text style={styles.movieMeta}>المدة: {movieDetails.duration}</Text> : null}
                              {movieDetails.rating ?? movieDetails.rate ? <Text style={styles.movieMeta}>التقييم: {movieDetails.rating ?? movieDetails.rate}</Text> : null}
                              {movieDetails.plot ? <Text style={styles.moviePlot}>{movieDetails.plot}</Text> : null}
                              {movieDetails.cast ? <Text style={styles.movieMeta}>الممثلون: {movieDetails.cast}</Text> : null}
                              <Pressable
                                accessibilityRole="button"
                                focusable
                                onPress={() => setPlayingMovie(movieDetails)}
                                style={styles.playMovieButton}
                              >
                                <Text style={styles.playMovieText}>تشغيل الفيلم</Text>
                              </Pressable>
                              {playingMovie?.id === movieDetails.id ? (
                                <View style={styles.playerSection}>
                                  <VideoView player={player} nativeControls contentFit="contain" style={styles.video} />
                                  {playbackError ? <Text accessibilityRole="alert" style={styles.catalogError}>{playbackError}</Text> : null}
                                </View>
                              ) : null}
                            </View>
                          ) : null}
                            </>
                          ) : <Text style={styles.catalogMessage}>اختر تصنيفًا من القائمة لعرض الأفلام.</Text>}
                        </View>
                      </View>
                    </>
                  ) : activeCategory === 'SERIES' || activeSeriesKeywords ? (
                    <>
                      {seriesCategoriesLoading ? <ActivityIndicator color={colors.lime} style={styles.catalogLoader} /> : null}
                      {seriesCategoriesError ? <Text accessibilityRole="alert" style={styles.catalogError}>{seriesCategoriesError}</Text> : null}
                      {!seriesCategoriesLoading && !seriesCategoriesError && seriesCategoriesLoaded && visibleSeriesCategories.length === 0 ? <Text style={styles.catalogMessage}>{activeSeriesKeywords ? 'لم يتم العثور على تصنيفات مطابقة.' : 'لا توجد تصنيفات للمسلسلات.'}</Text> : null}
                      <View style={[styles.movieBrowser, !isWide && styles.browserStacked]}>
                        <ScrollView style={[styles.movieSidebar, !isWide && styles.browserSidebarCompact]} nestedScrollEnabled>
                      {visibleSeriesCategories.map((category) => (
                        <View key={category.cat_id} style={styles.movieCategory}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ expanded: expandedSeriesCategory === category.cat_id }}
                            focusable
                            onPress={() => setExpandedSeriesCategory((current) => current === category.cat_id ? null : category.cat_id)}
                            style={[styles.browserCategory, expandedSeriesCategory === category.cat_id && styles.browserCategorySelected]}
                          >
                            <Text style={styles.browserCategoryText}>{category.cat_name.trim()}</Text>
                            <Text style={styles.packageId}>{category.sub_cats.length}</Text>
                          </Pressable>
                          {expandedSeriesCategory === category.cat_id ? category.sub_cats
                            .filter((subcategory) =>
                              !activeSeriesKeywords ||
                              matchesKeywords(category.cat_name, activeSeriesKeywords) ||
                              matchesKeywords(subcategory.sub_name, activeSeriesKeywords)
                            )
                            .map((subcategory) => (
                            <Pressable
                              key={subcategory.sub_id}
                              accessibilityRole="button"
                              focusable
                              onPress={() => void loadSeries(subcategory)}
                              style={[styles.browserSubcategory, selectedSeriesSubcategory === subcategory.sub_id && styles.browserCategorySelected]}
                            >
                              <Text style={styles.browserCategoryText}>{subcategory.sub_name.trim()}</Text>
                            </Pressable>
                          )) : null}
                        </View>
                      ))}
                        </ScrollView>
                        <View style={[styles.movieContent, !isWide && styles.browserContentCompact]}>
                      {selectedSeriesSubcategory ? (
                        <View style={styles.seriesResults}>
                          {seriesItemsLoading ? <ActivityIndicator color={colors.lime} style={styles.catalogLoader} /> : null}
                          {seriesItemsError ? <Text accessibilityRole="alert" style={styles.catalogError}>{seriesItemsError}</Text> : null}
                          {!seriesItemsLoading && !seriesItemsError && visibleSeriesItems.length === 0 ? <Text style={styles.catalogMessage}>{activeSeriesKeywords ? 'لا توجد مسلسلات مطابقة لهذا القسم.' : 'لا توجد مسلسلات في هذا التصنيف.'}</Text> : null}
                          <View style={styles.posterGrid}>
                            {visibleSeriesItems.map((item, index) => (
                              <Pressable
                                key={seriesId(item) || index}
                                accessibilityRole="button"
                                focusable
                                onPress={() => void loadSeriesEpisodes(item)}
                                style={[styles.posterCard, selectedSeriesItem && seriesId(selectedSeriesItem) === seriesId(item) && styles.posterCardSelected, { width: movieCardWidth, minHeight: posterHeight + 38 }]}
                              >
                                {seriesPoster(item) ? <Image source={{ uri: seriesPoster(item) }} resizeMode="cover" style={[styles.posterImage, { height: posterHeight }]} /> : <View style={[styles.posterPlaceholder, { height: posterHeight }]}><Text style={styles.posterPlaceholderText}>{seriesTitle(item).slice(0, 2)}</Text></View>}
                                <Text numberOfLines={2} style={styles.posterTitle}>{seriesTitle(item)}</Text>
                              </Pressable>
                            ))}
                          </View>
                          {selectedSeriesItem ? (
                            <View style={styles.seriesEpisodes}>
                              <View style={styles.seriesDetails}>
                                {seriesPoster(selectedSeriesItem) ? (
                                  <Image source={{ uri: seriesPoster(selectedSeriesItem) }} resizeMode="cover" style={styles.moviePoster} />
                                ) : null}
                                <Text style={styles.movieDetailsTitle}>{seriesTitle(selectedSeriesItem)}</Text>
                                {seriesValue(selectedSeriesItem, 'genre') ? <Text style={styles.movieMeta}>{seriesValue(selectedSeriesItem, 'genre')}</Text> : null}
                                {seriesValue(selectedSeriesItem, 'rating') ? <Text style={styles.movieMeta}>التقييم: {seriesValue(selectedSeriesItem, 'rating')}</Text> : null}
                                {seriesValue(selectedSeriesItem, 'releaseDate') ? <Text style={styles.movieMeta}>تاريخ الإصدار: {seriesValue(selectedSeriesItem, 'releaseDate')}</Text> : null}
                                {seriesValue(selectedSeriesItem, 'director') ? <Text style={styles.movieMeta}>الإخراج: {seriesValue(selectedSeriesItem, 'director')}</Text> : null}
                                {seriesValue(selectedSeriesItem, 'cast') ? <Text style={styles.movieMeta}>الممثلون: {seriesValue(selectedSeriesItem, 'cast')}</Text> : null}
                                {seriesValue(selectedSeriesItem, 'plot') ? <Text style={styles.moviePlot}>{seriesValue(selectedSeriesItem, 'plot')}</Text> : null}
                              </View>
                              {seriesEpisodesLoading ? <ActivityIndicator color={colors.lime} style={styles.catalogLoader} /> : null}
                              {seriesEpisodesError ? <Text accessibilityRole="alert" style={styles.catalogError}>{seriesEpisodesError}</Text> : null}
                              {seriesSeasons.map((season) => (
                                <View key={season} style={styles.seriesSeason}>
                                  <Text style={styles.seriesSeasonTitle}>الموسم {season}</Text>
                                  {seriesEpisodes.filter((episode) => String(episode.season_num) === season).map((episode) => (
                                    <Pressable
                                      key={`${season}-${episode.episode_num}`}
                                      accessibilityRole="button"
                                      focusable
                                      onPress={() => setPlayingEpisode(episode)}
                                      style={[styles.channelRow, playingEpisode?.stream_url === episode.stream_url && styles.packageRowSelected]}
                                    >
                                      <Text style={styles.movieOrder}>{episode.episode_num}</Text>
                                      <Text style={styles.movieTitle}>{episode.episode_name}</Text>
                                    </Pressable>
                                  ))}
                                </View>
                              ))}
                              {playingEpisode ? (
                                <View style={styles.playerSection}>
                                  <Text style={styles.channelHeading}>{playingEpisode.episode_name}</Text>
                                  <VideoView player={player} nativeControls contentFit="contain" style={styles.video} />
                                  {playbackError ? <Text accessibilityRole="alert" style={styles.catalogError}>{playbackError}</Text> : null}
                                </View>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                        </View>
                      </View>
                    </>
                  ) : activeCategory === 'SAT2IPTV' ? (
                    <>
                      {sat2iptvLoading ? <ActivityIndicator color={colors.lime} style={styles.catalogLoader} /> : null}
                      {sat2iptvError ? <Text accessibilityRole="alert" style={styles.catalogError}>{sat2iptvError}</Text> : null}
                      {!sat2iptvLoading && !sat2iptvError && sat2iptvLoaded && sat2iptvChannels.length === 0 ? <Text style={styles.catalogMessage}>لا توجد قنوات SAT إلى IPTV متاحة.</Text> : null}
                      {sat2iptvChannels.map((channel, index) => (
                        <Pressable
                          key={`${channel.stream_url}-${index}`}
                          accessibilityRole="button"
                          focusable
                          onPress={() => setSelectedChannel(channel)}
                          style={[styles.channelRow, selectedChannel?.stream_url === channel.stream_url && styles.packageRowSelected]}
                        >
                          <View style={styles.sportsChannelCopy}>
                            <Text style={styles.channelName}>{channel.channel_name}</Text>
                            <Text style={styles.channelMeta}>
                              {[channel.angle, channel.tp, channel.pol, channel.sid].filter(Boolean).join(' · ') || 'SAT إلى IPTV'}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                      {selectedChannel ? (
                        <View style={styles.playerSection}>
                          <Text style={styles.channelHeading}>{selectedChannel.channel_name}</Text>
                          <VideoView player={player} nativeControls contentFit="contain" style={styles.video} />
                          {playbackError ? <Text accessibilityRole="alert" style={styles.catalogError}>{playbackError}</Text> : null}
                        </View>
                      ) : null}
                    </>
                  ) : activeCategory === 'SPORTS' ? (
                    <>
                      {sportsLoading ? <ActivityIndicator color={colors.lime} style={styles.catalogLoader} /> : null}
                      {sportsError ? <Text accessibilityRole="alert" style={styles.catalogError}>{sportsError}</Text> : null}
                      {!sportsLoading && !sportsError && sportsLoaded && sportsChannels.length === 0 ? <Text style={styles.catalogMessage}>لم يتم العثور على قنوات رياضية.</Text> : null}
                      <View style={[styles.liveBrowser, !isWide && styles.browserStacked]}>
                        <ScrollView style={[styles.liveSidebar, !isWide && styles.browserSidebarCompact]} nestedScrollEnabled>
                          <Text style={styles.browserHeading}>الباقات الرياضية</Text>
                          {sportsPackageNames.map((packageName) => (
                            <Pressable
                              key={packageName}
                              accessibilityRole="button"
                              focusable
                              onPress={() => {
                                setSelectedSportsPackage(packageName);
                                setSelectedChannel(null);
                              }}
                              style={[styles.browserCategory, selectedSportsPackage === packageName && styles.browserCategorySelected]}
                            >
                              <Text style={styles.browserCategoryText}>{packageName}</Text>
                              <Text style={styles.packageId}>{sportsChannels.filter((item) => item.packageName === packageName).length}</Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                        <View style={[styles.liveContent, !isWide && styles.browserContentCompact]}>
                          {selectedSportsPackage ? (
                            <>
                              <Text style={styles.channelHeading}>{selectedSportsPackage}</Text>
                              {sportsChannels.filter(({ packageName }) => packageName === selectedSportsPackage).map(({ channel }, index) => (
                                <Pressable
                                  key={`${channel.stream_url}-${index}`}
                                  accessibilityRole="button"
                                  focusable
                                  onPress={() => setSelectedChannel(channel)}
                                  style={[styles.channelRow, selectedChannel?.stream_url === channel.stream_url && styles.packageRowSelected]}
                                >
                                  <Text style={styles.channelName}>{channel.channel_name}</Text>
                                </Pressable>
                              ))}
                            </>
                          ) : <Text style={styles.catalogMessage}>اختر باقة رياضية لعرض قنواتها.</Text>}
                          {selectedChannel ? (
                            <View style={styles.playerSection}>
                              <Text style={styles.channelHeading}>{selectedChannel.channel_name}</Text>
                              <VideoView player={player} nativeControls contentFit="contain" style={styles.video} />
                              {playbackError ? <Text accessibilityRole="alert" style={styles.catalogError}>{playbackError}</Text> : null}
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </>
                  ) : activeCategory === 'SETTINGS' ? (
                    <View style={styles.settingsLayout}>
                      <View style={styles.settingsSidebar}>
                        {settingsSections.map((section) => (
                          <Pressable
                            key={section.id}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: activeSettingsSection === section.id }}
                            focusable
                            onPress={() => setActiveSettingsSection(section.id)}
                            style={[styles.settingsNavItem, activeSettingsSection === section.id && styles.settingsNavItemSelected]}
                          >
                            <Text style={[styles.settingsNavIcon, activeSettingsSection === section.id && styles.settingsNavTextSelected]}>{section.icon}</Text>
                            <Text style={[styles.settingsNavText, activeSettingsSection === section.id && styles.settingsNavTextSelected]}>{section.label}</Text>
                          </Pressable>
                        ))}
                        <Pressable accessibilityRole="button" focusable onPress={logout} style={styles.logoutButton}>
                          <Text style={styles.logoutText}>ⓘ　Logout</Text>
                        </Pressable>
                      </View>
                      <View style={styles.settingsContent}>
                        <Text style={styles.settingsContentTitle}>
                          {settingsSections.find((section) => section.id === activeSettingsSection)?.label}
                        </Text>
                        {activeSettingsSection === 'ACCOUNT' || activeSettingsSection === 'ADVANCED' ? (
                          <View style={styles.settingsDetails}>
                            {activeSettingsSection === 'ADVANCED' ? <Text style={styles.settingsSectionHeading}>Account</Text> : null}
                            <View style={styles.settingsDetailRow}>
                              <Text style={styles.settingsDetailLabel}>User ID:</Text>
                              <Text style={styles.settingsDetailValue}>{result?.code_id ?? '—'}</Text>
                            </View>
                            <View style={styles.settingsDetailRow}>
                              <Text style={styles.settingsDetailLabel}>Code:</Text>
                              <Text style={styles.settingsDetailValue}>{form.code || '—'}</Text>
                            </View>
                            <View style={styles.settingsDetailRow}>
                              <Text style={styles.settingsDetailLabel}>Expires:</Text>
                              <Text style={styles.settingsDetailValue}>{result?.expire || 'غير متوفر'}</Text>
                            </View>
                            {activeSettingsSection === 'ACCOUNT' && result?.user_agent ? (
                              <View style={styles.settingsDetailRow}>
                                <Text style={styles.settingsDetailLabel}>Player:</Text>
                                <Text style={styles.settingsDetailValue}>{result.user_agent}</Text>
                              </View>
                            ) : null}
                          </View>
                        ) : activeSettingsSection === 'APPEARANCE' ? (
                          <View style={styles.settingsDetails}>
                            <Text style={styles.settingsSectionHeading}>Theme</Text>
                            <View style={styles.settingsDetailRow}>
                              <Text style={styles.settingsDetailLabel}>Appearance:</Text>
                              <Text style={styles.settingsDetailValue}>Dark Neon</Text>
                            </View>
                            <View style={styles.settingsDetailRow}>
                              <Text style={styles.settingsDetailLabel}>Accent colors:</Text>
                              <View style={styles.appearanceSwatches}>
                                <View style={[styles.appearanceSwatch, styles.appearanceSwatchBlue]} />
                                <View style={[styles.appearanceSwatch, styles.appearanceSwatchPurple]} />
                              </View>
                            </View>
                          </View>
                        ) : (
                          <View style={styles.settingsDetails}>
                            <Text style={styles.settingsSectionHeading}>Galaxy TV</Text>
                            <View style={styles.settingsDetailRow}>
                              <Text style={styles.settingsDetailLabel}>Version:</Text>
                              <Text style={styles.settingsDetailValue}>1.01</Text>
                            </View>
                            <Text style={styles.settingsAboutText}>© 2026 Galaxy TV. All rights reserved.</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.catalogMessage}>لا توجد قائمة متصلة بهذا القسم بعد.</Text>
                  )}
                </View>
                  </>
                )}
              </View>
            ) : null}
          </View>

          <Text style={styles.footer}>{isWide ? 'ANDROID TV READY' : 'ANDROID  ·  iOS'}</Text>
          <Text style={styles.copyrightNotice}>© 2026 Galaxy TV · الإصدار 1.01 · جميع الحقوق محفوظة</Text>
        </View>
      </ScrollView>

      {notice ? (
        <View accessibilityLiveRegion="polite" accessibilityRole="alert" pointerEvents="none" style={[styles.notice, activated ? styles.noticeSuccess : styles.noticeFailure]}>
          <Text style={styles.noticeTitle}>{notice.title}</Text>
          {notice.detail ? <Text style={styles.noticeDetail}>{notice.detail}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const colors = {
  ink: '#050817',
  background: '#050817',
  panel: '#080B1B',
  field: '#080B1B',
  line: '#1B3155',
  muted: '#91A6C7',
  text: '#E9F4FF',
  lime: '#25D9FF',
  coral: '#FF3DA8',
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  page: { flexGrow: 1, paddingHorizontal: 22, paddingVertical: 14, paddingBottom: 40, alignItems: 'center' },
  content: { width: '100%', maxWidth: 680 },
  contentWide: { maxWidth: 920 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  loginBrand: { alignItems: 'center', marginTop: 14, marginBottom: 30 },
  loginLogo: { width: 200, height: 200 },
  brandMark: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#251A39', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#554166' },
  brandGlyph: { color: '#F4FBFF', fontSize: 20, fontWeight: '900' },
  liveTag: { marginLeft: 'auto', borderColor: colors.line, borderWidth: 1, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.lime, marginRight: 7 },
  liveText: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  headingBlock: { marginBottom: 16, alignItems: 'center' },
  kicker: { color: '#25D9FF', fontSize: 13, marginBottom: 5 },
  title: { color: '#3B9DFF', fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: 2, textShadowColor: '#D52EFF', textShadowRadius: 10 },
  subtitle: { color: colors.muted, fontSize: 14, marginTop: 5, textAlign: 'center' },
  form: { backgroundColor: colors.panel, borderColor: '#1B3155', borderWidth: 1, borderRadius: 12, padding: 20 },
  sectionHead: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 18 },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  sectionRule: { height: 1, flex: 1, backgroundColor: colors.line, marginLeft: 12 },
  fieldGrid: { flexDirection: 'column' },
  fieldGridWide: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  field: { width: '100%', marginBottom: 15 },
  fieldWide: { width: '48%' },
  label: { color: colors.muted, fontSize: 12, textAlign: 'right', marginBottom: 7 },
  input: { minHeight: 48, borderRadius: 9, borderColor: colors.line, borderWidth: 1, backgroundColor: colors.field, color: colors.text, paddingHorizontal: 13, fontSize: 15, textAlign: 'left' },
  button: { minHeight: 52, borderRadius: 12, backgroundColor: '#25D9FF', marginTop: 4, paddingHorizontal: 16, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#8DEBFF' },
  buttonFocused: { borderColor: '#F8F2FF', borderWidth: 2 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  buttonArrow: { color: colors.ink, fontSize: 19, marginLeft: 10 },
  error: { color: colors.coral, marginTop: 13, textAlign: 'right', fontSize: 13 },
  result: { borderRadius: 10, borderWidth: 1, padding: 14, marginTop: 16 },
  resultSuccess: { borderColor: '#25D9FF', backgroundColor: '#071A2A' },
  resultFailure: { borderColor: '#7D334D', backgroundColor: '#291321' },
  resultTop: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12 },
  resultDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 9 },
  resultDotSuccess: { backgroundColor: colors.lime },
  resultDotFailure: { backgroundColor: colors.coral },
  resultTitle: { flex: 1, color: colors.text, textAlign: 'right', fontSize: 14, fontWeight: '700' },
  resultCode: { color: colors.muted, marginLeft: 10, fontVariant: ['tabular-nums'] },
  detailRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingTop: 9, borderTopColor: colors.line, borderTopWidth: 1, marginTop: 8 },
  detailValue: { color: colors.text, fontSize: 13 },
  detailLabel: { color: colors.muted, fontSize: 12 },
  osd: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 11, textAlign: 'right' },
  catalog: { marginTop: 10, width: '100%' },
  browserCatalog: { width: '100%', alignItems: 'stretch', justifyContent: 'flex-start', paddingHorizontal: 10 },
  liveBrowser: { width: '100%', flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  liveSidebar: { width: '28%', minWidth: 120, maxWidth: 220, borderRightWidth: 1, borderColor: '#1B3155', paddingRight: 8 },
  liveContent: { flex: 1, minWidth: 0, alignItems: 'stretch' },
  movieBrowser: { width: '100%', minHeight: 280, flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  movieSidebar: { width: '28%', minWidth: 116, maxWidth: 220, maxHeight: 480, borderRightWidth: 1, borderColor: '#1B3155', paddingRight: 8 },
  movieContent: { flex: 1, minWidth: 0, alignItems: 'stretch' },
  browserStacked: { flexDirection: 'column' },
  browserSidebarCompact: { width: '100%', maxWidth: undefined, minWidth: 0, maxHeight: 135, borderRightWidth: 0, borderBottomWidth: 1, paddingRight: 0, paddingBottom: 8 },
  browserContentCompact: { width: '100%' },
  browserHeading: { color: '#25D9FF', fontSize: 13, fontWeight: '700', paddingVertical: 8, paddingHorizontal: 6, textAlign: 'left' },
  browserCategory: { minHeight: 39, width: '100%', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 7, backgroundColor: '#090D1B', borderBottomWidth: 1, borderColor: '#1B3155' },
  browserCategorySelected: { backgroundColor: '#101A35', borderColor: '#25D9FF' },
  browserCategoryText: { flex: 1, color: colors.text, fontSize: 12, textAlign: 'right' },
  browserSubcategory: { minHeight: 34, width: '100%', justifyContent: 'center', paddingHorizontal: 8, paddingLeft: 15, backgroundColor: '#070A16', borderBottomWidth: 1, borderColor: '#12213D' },
  posterGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' },
  posterCard: { overflow: 'hidden', backgroundColor: '#080B1B', borderWidth: 1, borderColor: '#152746', borderRadius: 5 },
  posterCardSelected: { borderColor: '#25D9FF', backgroundColor: '#101A35' },
  posterImage: { width: '100%', backgroundColor: '#101A35' },
  posterPlaceholder: { width: '100%', backgroundColor: '#101A35', alignItems: 'center', justifyContent: 'center' },
  posterPlaceholderText: { color: '#25D9FF', fontSize: 25, fontWeight: '800' },
  posterTitle: { minHeight: 34, color: colors.text, fontSize: 11, lineHeight: 15, padding: 5, textAlign: 'center' },
  kidsSources: { width: '100%', gap: 12, paddingVertical: 18 },
  kidsSourceButton: { minHeight: 60, borderRadius: 10, borderWidth: 1, borderColor: '#D52EFF', backgroundColor: '#0A0D20', alignItems: 'center', justifyContent: 'center', shadowColor: '#D52EFF', shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
  kidsSourceLabel: { color: '#E9F4FF', fontSize: 18, fontWeight: '700' },
  catalogForm: { backgroundColor: 'transparent', borderWidth: 0, padding: 0 },
  homeMenu: { width: '100%', flexDirection: 'row', gap: 14 },
  homeMenuCompact: { flexDirection: 'column' },
  homePrimaryTiles: { flex: 1.15, flexDirection: 'row', gap: 12 },
  homePrimaryTilesCompact: { flex: 0 },
  homeSecondaryTiles: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignContent: 'space-between' },
  homeSecondaryTilesCompact: { flex: 0 },
  homeTile: { backgroundColor: '#070B1B', borderWidth: 1.5, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 5 },
  homePrimaryTile: { flex: 1 },
  homePrimaryTileCompact: { minHeight: 150 },
  homeSecondaryTile: { width: '47%', flexGrow: 1, padding: 6 },
  homePrimaryIcon: { fontSize: 48, textShadowColor: '#25D9FF', textShadowRadius: 12 },
  homePrimaryLabel: { fontSize: 21, fontWeight: '700', marginTop: 7, letterSpacing: 1 },
  homeSecondaryIcon: { fontSize: 26, textShadowColor: '#25D9FF', textShadowRadius: 9 },
  homeSecondaryLabel: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  categoryTabs: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, backgroundColor: '#070B1B', borderWidth: 1, borderColor: '#1B3155', borderRadius: 12, padding: 8 },
  homeBackButton: { minWidth: 48, minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: '#25D9FF', alignItems: 'center', justifyContent: 'center' },
  homeBackLabel: { color: '#25D9FF', fontSize: 23, fontWeight: '800' },
  categoryTab: { flexGrow: 1, flexBasis: '25%', minWidth: 100, minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: '#1B3155', backgroundColor: '#080B1B', alignItems: 'center', justifyContent: 'center' },
  categoryTabSelected: { borderColor: '#25D9FF', backgroundColor: '#101A35', shadowColor: '#25D9FF', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  categoryLabel: { color: colors.muted, fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  categoryLabelSelected: { color: colors.text },
  catalogEmpty: { minHeight: 120, marginTop: 12, borderTopWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  catalogTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  catalogMessage: { color: colors.muted, fontSize: 13, marginTop: 8, textAlign: 'center' },
  catalogLoader: { marginVertical: 16 },
  catalogError: { color: colors.coral, fontSize: 13, marginVertical: 10, textAlign: 'right' },
  packageRow: { minHeight: 50, width: '100%', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 13, borderBottomWidth: 1, borderColor: colors.line },
  packageRowSelected: { backgroundColor: '#101A35', borderColor: colors.lime },
  movieCategory: { width: '100%' },
  seriesResults: { width: '100%', marginTop: 14 },
  seriesEpisodes: { width: '100%', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderColor: colors.line },
  seriesDetails: { width: '100%', marginBottom: 14, alignItems: 'flex-end' },
  seriesSeason: { width: '100%', marginTop: 12 },
  seriesSeasonTitle: { color: colors.lime, fontSize: 14, fontWeight: '700', textAlign: 'right', paddingVertical: 8 },
  settingsLayout: { width: '100%', minHeight: 245, flexDirection: 'row', borderWidth: 1, borderColor: '#1B3155', backgroundColor: '#050817', padding: 10, gap: 12 },
  settingsSidebar: { width: '34%', minWidth: 140, borderRightWidth: 1, borderRightColor: '#1B3155', paddingRight: 10 },
  settingsNavItem: { minHeight: 42, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, marginBottom: 4, borderRadius: 5, borderWidth: 1, borderColor: 'transparent' },
  settingsNavItemSelected: { borderColor: '#25D9FF', backgroundColor: '#0A1730', shadowColor: '#25D9FF', shadowOpacity: 0.2, shadowRadius: 7, elevation: 2 },
  settingsNavIcon: { width: 24, color: '#91A6C7', fontSize: 15, textAlign: 'center', marginRight: 6 },
  settingsNavText: { color: '#91A6C7', fontSize: 13, fontWeight: '600' },
  settingsNavTextSelected: { color: '#E9F4FF' },
  logoutButton: { minHeight: 40, marginTop: 9, paddingHorizontal: 9, borderRadius: 5, borderWidth: 1, borderColor: '#FF3DA8', backgroundColor: '#170B1D', alignItems: 'center', justifyContent: 'center' },
  logoutText: { color: '#FF3DA8', fontSize: 13, fontWeight: '700' },
  settingsContent: { flex: 1, padding: 9 },
  settingsContentTitle: { color: '#25D9FF', fontSize: 16, fontWeight: '700', marginBottom: 14 },
  settingsDetails: { flex: 1, justifyContent: 'center' },
  settingsSectionHeading: { color: '#E9F4FF', fontSize: 14, marginBottom: 13 },
  settingsDetailRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#12213D' },
  settingsDetailLabel: { color: '#91A6C7', fontSize: 12, marginRight: 5 },
  settingsDetailValue: { color: '#E9F4FF', fontSize: 12, flexShrink: 1 },
  appearanceSwatches: { flexDirection: 'row', gap: 8, marginLeft: 4 },
  appearanceSwatch: { width: 16, height: 16, borderRadius: 8 },
  appearanceSwatchBlue: { backgroundColor: '#25D9FF' },
  appearanceSwatchPurple: { backgroundColor: '#D52EFF' },
  settingsAboutText: { color: '#91A6C7', fontSize: 11, marginTop: 12 },
  movieSubcategory: { minHeight: 44, width: '100%', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 24, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: '#100D1D' },
  movieSubcategorySelected: { backgroundColor: '#101A35', borderColor: colors.lime },
  subcategoryOrder: { color: colors.muted, fontSize: 11, marginRight: 12 },
  movieResults: { width: '100%', marginTop: 14 },
  movieBackButton: { minHeight: 42, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 12, borderBottomWidth: 1, borderColor: colors.line },
  movieBackText: { color: colors.lime, fontSize: 13, fontWeight: '700' },
  movieRow: { minHeight: 50, width: '100%', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderColor: colors.line },
  movieOrder: { width: 35, color: colors.muted, fontSize: 11, textAlign: 'left' },
  movieTitle: { flex: 1, color: colors.text, fontSize: 13, textAlign: 'right' },
  movieDetails: { width: '100%', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderColor: colors.line, alignItems: 'flex-end' },
  moviePoster: { width: 88, height: 132, borderRadius: 6, backgroundColor: colors.field, marginBottom: 12 },
  movieDetailsTitle: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'right' },
  movieMeta: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 6, textAlign: 'right' },
  moviePlot: { color: colors.text, fontSize: 13, lineHeight: 21, marginTop: 10, textAlign: 'right' },
  playMovieButton: { minHeight: 48, width: '100%', marginTop: 14, borderRadius: 8, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  playMovieText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  packageName: { flex: 1, color: colors.text, fontSize: 14, textAlign: 'right' },
  packageId: { color: colors.muted, fontSize: 11, marginRight: 12 },
  channelList: { width: '100%', marginTop: 15 },
  channelHeading: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'right', marginBottom: 8 },
  channelRow: { minHeight: 48, width: '100%', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 13, borderBottomWidth: 1, borderColor: colors.line },
  channelName: { flex: 1, color: colors.text, fontSize: 13, textAlign: 'right' },
  channelMeta: { color: colors.muted, fontSize: 11, marginRight: 10 },
  sportsChannelCopy: { flex: 1, alignItems: 'flex-end' },
  playerSection: { width: '100%', marginTop: 18 },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', marginTop: 8 },
  notice: { position: 'absolute', bottom: 20, left: 18, right: 18, borderRadius: 8, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 13 },
  noticeSuccess: { backgroundColor: '#11251F', borderColor: '#36C9A5' },
  noticeFailure: { backgroundColor: '#291321', borderColor: '#7D334D' },
  noticeTitle: { color: colors.text, textAlign: 'right', fontSize: 14, fontWeight: '800' },
  noticeDetail: { color: colors.muted, textAlign: 'right', fontSize: 12, lineHeight: 19, marginTop: 4 },
  footer: { color: colors.muted, fontSize: 9, marginTop: 20, textAlign: 'center' },
  copyrightNotice: { color: colors.muted, fontSize: 10, marginTop: 8, textAlign: 'center' },
});
