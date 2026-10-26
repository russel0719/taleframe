import type { ComponentType } from 'react';
import type { TemplateId } from '@/lib/story/schema';
import { ColorField, Diptych, FilmRoll, KineticType, PaletteDiary, RisoPrint, Spotlight, Verse } from './art';
import { DailyTimeline, FoodReview, Closing, Recommendation, TravelStats } from './experience';
import { BeforeAfter, PhotoGallery, PhotoOverlay, PhotoSingle, PhotoStrip, PolaroidCollage } from './gallery';
import { HeroFullbleed, PostcardCover } from './hero';
import { ContactSheet, DayClock, PhotoMap, StampRally, TransitTicket } from './keepsake';
import { PhotoStack, PostcardBack, Receipt, ScrapObject, SplitFlap, WalkLine } from './paper';
import { GlobeIntro, MapJourney, Panorama, PlaceFeature, SplitFeature } from './place';
import { ChapterDivider, EditorialText, FactCard, QuoteMoment, WeatherCard } from './text';
import type { TemplateProps } from './types';
import { ScrollScrub, StickyStory, VideoCinematic } from './video';

/**
 * 등록된 템플릿만 렌더링한다. story.json 의 template 값은 스키마가 이 목록으로 제한하므로
 * 임의의 컴포넌트나 코드가 실행될 길이 없다.
 */
export const registry: { [K in TemplateId]: ComponentType<TemplateProps<K>> } = {
  'hero-fullbleed': HeroFullbleed,
  'globe-intro': GlobeIntro,
  'postcard-cover': PostcardCover,
  'chapter-divider': ChapterDivider,
  'editorial-text': EditorialText,
  'quote-moment': QuoteMoment,
  'fact-card': FactCard,
  'weather-card': WeatherCard,
  'photo-single': PhotoSingle,
  'photo-overlay': PhotoOverlay,
  'photo-gallery': PhotoGallery,
  'photo-strip': PhotoStrip,
  'polaroid-collage': PolaroidCollage,
  'before-after': BeforeAfter,
  'split-feature': SplitFeature,
  panorama: Panorama,
  'video-cinematic': VideoCinematic,
  'scroll-scrub': ScrollScrub,
  'sticky-story': StickyStory,
  'map-journey': MapJourney,
  'place-feature': PlaceFeature,
  'food-review': FoodReview,
  recommendation: Recommendation,
  'daily-timeline': DailyTimeline,
  'travel-stats': TravelStats,
  closing: Closing,
  verse: Verse,
  'color-field': ColorField,
  'film-roll': FilmRoll,
  diptych: Diptych,
  spotlight: Spotlight,
  'riso-print': RisoPrint,
  'kinetic-type': KineticType,
  'stamp-rally': StampRally,
  'transit-ticket': TransitTicket,
  'day-clock': DayClock,
  'contact-sheet': ContactSheet,
  'photo-map': PhotoMap,
  'palette-diary': PaletteDiary,
  'postcard-back': PostcardBack,
  receipt: Receipt,
  'walk-line': WalkLine,
  'split-flap': SplitFlap,
  'photo-stack': PhotoStack,
  'scrap-object': ScrapObject,
};
