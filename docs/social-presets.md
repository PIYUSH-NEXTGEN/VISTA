# Social image presets

Preset dimensions are kept in `src/core/image-ops/social-presets.ts` so they can
be updated without changing the Create screen. Platform requirements can change;
check the platform's current help page before publishing. Checked 2026-10-30.

| Preset              |  Dimensions | Basis                                                                                     |
| ------------------- | ----------: | ----------------------------------------------------------------------------------------- |
| X profile photo     |   400 × 400 | X Help recommends a 400 × 400 profile image.                                              |
| X header            |  1500 × 500 | X Help recommends a 1500 × 500 header image.                                              |
| X post photo        | 1080 × 1440 | 3:4, at the portrait edge of X's stated 2:1 to 3:4 photo range.                           |
| LinkedIn photo post | 1080 × 1350 | 4:5, within LinkedIn's stated 3:1 to 4:5 range; 1080 px width follows its recommendation. |
| LinkedIn link image |  1200 × 627 | LinkedIn's recommended 1.91:1 link image.                                                 |
| Square post         | 1080 × 1080 | Generic square output, not a platform guarantee.                                          |
| Vertical story      | 1080 × 1920 | Generic 9:16 output, not a platform guarantee.                                            |

Sources:

- [X Help: posting photos](https://help.x.com/en/using-x/posting-gifs-and-pictures?product=service)
- [X Help: profile photo and header dimensions](https://help.x.com/en/managing-your-account/common-issues-when-uploading-profile-photo.html)
- [LinkedIn Help: share photos or videos](https://www.linkedin.com/help/linkedin/answer/a527229/share-photos-or-videos?lang=en)
- [LinkedIn Help: image specifications](https://www.linkedin.com/help/linkedin/answer/a563309/image-specifications-for-your-linkedin-pages-and-career-pages)

The profile creator center-crops the first selected image. Circle output is a
transparent PNG. Contact sheets are single-page JPEG images; PDF output wraps
the same JPEG as one PDF page. These outputs are generated locally in a worker.
