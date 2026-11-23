import { ExercisePhoto } from '../types';

/**
 * Real photographs of the exercises, from free-licence collections that allow commercial use
 * (Flickr via Openverse and Wikimedia Commons: CC BY, CC BY-SA, CC0 and public domain).
 * Each photo was checked by eye against the exercise. Credits are shown with the photo and listed
 * in public/exercises/photos/CREDITOS.md, as the licences require.
 */
type PhotoEntry = Omit<ExercisePhoto, 'url'> & { file: string };

const PHOTOS: Record<string, PhotoEntry> = {
  "ex-ref-10": {
    file: "ex-ref-10.jpg",
    author: "runwaypilates",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/deed.pt-br",
    sourceUrl: "https://www.flickr.com/photos/150388148@N02/35315153304",
  },
  "ex-ref-7": {
    file: "ex-ref-7.jpg",
    author: "runwaypilates",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/deed.pt-br",
    sourceUrl: "https://www.flickr.com/photos/150388148@N02/35986177122",
  },
  "ex-ref-12": {
    file: "ex-ref-12.jpg",
    author: "runwaypilates",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/deed.pt-br",
    sourceUrl: "https://www.flickr.com/photos/150388148@N02/36154468635",
  },
  "ex-ref-11": {
    file: "ex-ref-11.jpg",
    author: "runwaypilates",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/deed.pt-br",
    sourceUrl: "https://www.flickr.com/photos/150388148@N02/35987028712",
  },
  "ex-ref-6": {
    file: "ex-ref-6.jpg",
    author: "runwaypilates",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/deed.pt-br",
    sourceUrl: "https://www.flickr.com/photos/150388148@N02/35986603642",
  },
  "ex-ref-15": {
    file: "ex-ref-15.jpg",
    author: "runwaypilates",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/deed.pt-br",
    sourceUrl: "https://www.flickr.com/photos/150388148@N02/36022885121",
  },
  "ex-ref-16": {
    file: "ex-ref-16.jpg",
    author: "runwaypilates",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/deed.pt-br",
    sourceUrl: "https://www.flickr.com/photos/150388148@N02/35763630630",
  },
  "ex-ref-17": {
    file: "ex-ref-17.jpg",
    author: "runwaypilates",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/deed.pt-br",
    sourceUrl: "https://www.flickr.com/photos/150388148@N02/36155800605",
  },
  "ex-ref-18": {
    file: "ex-ref-18.jpg",
    author: "runwaypilates",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/deed.pt-br",
    sourceUrl: "https://www.flickr.com/photos/150388148@N02/36152584265",
  },
  "ex-ref-4": {
    file: "ex-ref-4.jpg",
    author: "Robert Bejil Productions",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/deed.pt-br",
    sourceUrl: "https://www.flickr.com/photos/28618109@N05/6449978579",
  },
  "ex-ref-8": {
    file: "ex-ref-8.jpg",
    author: "Robert Bejil Productions",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/deed.pt-br",
    sourceUrl: "https://www.flickr.com/photos/28618109@N05/6449977779",
  },
  "ex-ref-19": {
    file: "ex-ref-19.jpg",
    author: "Robert Bejil Productions",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/deed.pt-br",
    sourceUrl: "https://www.flickr.com/photos/28618109@N05/6449978179",
  },
  "ex-chr-4": {
    file: "ex-chr-4.jpg",
    author: "Robert Bejil Productions",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/deed.pt-br",
    sourceUrl: "https://www.flickr.com/photos/28618109@N05/6449979513",
    position: "center 30%",
  },
  "ex-mat-15": {
    file: "ex-mat-15.jpg",
    author: "LunaCobanli",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/deed.pt-br",
    sourceUrl: "https://www.flickr.com/photos/62205255@N06/6365649265",
  },
  "ex-mat-7": {
    file: "ex-mat-7.jpg",
    author: "sazztastical",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/deed.pt-br",
    sourceUrl: "https://www.flickr.com/photos/80452444@N00/4136259147",
  },
  "ex-sol-3": {
    file: "ex-sol-3.jpg",
    author: "LunaCobanli",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/deed.pt-br",
    sourceUrl: "https://www.flickr.com/photos/62205255@N06/6365669707",
  },
  "ex-mat-21": {
    file: "ex-mat-21.jpg",
    author: "Robert Bejil Productions",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/deed.pt-br",
    sourceUrl: "https://www.flickr.com/photos/28618109@N05/6449944999",
    position: "center 20%",
  },
  "ex-mat-22": {
    file: "ex-mat-22.jpg",
    author: "Robert Bejil Productions",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/deed.pt-br",
    sourceUrl: "https://www.flickr.com/photos/28618109@N05/6449976919",
    position: "center 15%",
  },
  "ex-chr-8": {
    file: "ex-chr-8.jpg",
    author: "Mrs. Ruti Shafir",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/deed.pt-br",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Pilates_Wunda_Chair.jpg",
  },
  "ex-mat-1": {
    file: "ex-mat-1.jpg",
    author: "Helisusa",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.pt-br",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Pilates-hundred-sata.jpg",
  },
  "ex-sol-2": {
    file: "ex-sol-2.jpg",
    author: "Helisusa",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.pt-br",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Pilates-yhden-jalan-ojennus.jpg",
  },
  "ex-mat-13": {
    file: "ex-mat-13.jpg",
    author: "Helisusa",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.pt-br",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Pilates-back-stretch.jpg",
  },
  "ex-mat-6": {
    file: "ex-mat-6.jpg",
    author: "J. Vílchez",
    license: "Domínio público",
    licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/deed.pt-br",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Pilates_01.jpg",
  },
  "ex-mat-14": {
    file: "ex-mat-14.jpg",
    author: "Cristian.mirandapezo",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.pt-br",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Ejercicio_con_Flex-band_en_Pilates.jpg",
  },
  "ex-mat-20": {
    file: "ex-mat-20.jpg",
    author: "Helisusa",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/deed.pt-br",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Pilates-sivulankku.jpg",
  },
};

export function photoFor(exerciseId: string): ExercisePhoto | undefined {
  const p = PHOTOS[exerciseId];
  if (!p) return undefined;
  const { file, ...rest } = p;
  return { ...rest, url: `${import.meta.env.BASE_URL}exercises/photos/${file}` };
}
