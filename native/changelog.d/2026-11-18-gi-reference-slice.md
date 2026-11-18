- **`gi-reference --slice N`** sets the samples per GPU submission for `--pt`. Scenes near two
  million triangles at 2560 x 1440 ran a submission long enough for the Windows GPU watchdog to
  remove the device (HRESULT 0x887A0006); a smaller slice keeps each submission short. The image is
  unchanged, because sample indices are absolute. Seen on an RTX 4090: the default failed on a
  2.1 million triangle scene at 1280 x 720, 256 spp, and `--slice 8` rendered it.
