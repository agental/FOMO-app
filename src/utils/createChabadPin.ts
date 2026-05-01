export function createChabadPinSVG(): SVGElement {
  const PIN_W = 44;
  const PIN_H = 54;

  const svgNS = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', String(PIN_W));
  svg.setAttribute('height', String(PIN_H));
  svg.setAttribute('viewBox', '0 0 30 40');
  svg.setAttribute('fill', 'none');
  svg.style.cssText = 'overflow:visible;display:block;';

  const defsEl = document.createElementNS(svgNS, 'defs');

  const filter = document.createElementNS(svgNS, 'filter');
  filter.setAttribute('id', 'chabadShadow');
  filter.setAttribute('x', '1.38837');
  filter.setAttribute('y', '4.26099');
  filter.setAttribute('width', '27.3913');
  filter.setAttribute('height', '29.3478');
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  const feFlood = document.createElementNS(svgNS, 'feFlood');
  feFlood.setAttribute('flood-opacity', '0');
  feFlood.setAttribute('result', 'BackgroundImageFix');

  const feColorMatrix1 = document.createElementNS(svgNS, 'feColorMatrix');
  feColorMatrix1.setAttribute('in', 'SourceAlpha');
  feColorMatrix1.setAttribute('type', 'matrix');
  feColorMatrix1.setAttribute('values', '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0');
  feColorMatrix1.setAttribute('result', 'hardAlpha');

  const feOffset = document.createElementNS(svgNS, 'feOffset');
  feOffset.setAttribute('dy', '2.6087');

  const feGaussianBlur = document.createElementNS(svgNS, 'feGaussianBlur');
  feGaussianBlur.setAttribute('stdDeviation', '1.30435');

  const feComposite = document.createElementNS(svgNS, 'feComposite');
  feComposite.setAttribute('in2', 'hardAlpha');
  feComposite.setAttribute('operator', 'out');

  const feColorMatrix2 = document.createElementNS(svgNS, 'feColorMatrix');
  feColorMatrix2.setAttribute('type', 'matrix');
  feColorMatrix2.setAttribute('values', '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0');

  const feBlend1 = document.createElementNS(svgNS, 'feBlend');
  feBlend1.setAttribute('mode', 'normal');
  feBlend1.setAttribute('in2', 'BackgroundImageFix');
  feBlend1.setAttribute('result', 'effect1_dropShadow_0_1');

  const feBlend2 = document.createElementNS(svgNS, 'feBlend');
  feBlend2.setAttribute('mode', 'normal');
  feBlend2.setAttribute('in', 'SourceGraphic');
  feBlend2.setAttribute('in2', 'effect1_dropShadow_0_1');
  feBlend2.setAttribute('result', 'shape');

  filter.appendChild(feFlood);
  filter.appendChild(feColorMatrix1);
  filter.appendChild(feOffset);
  filter.appendChild(feGaussianBlur);
  filter.appendChild(feComposite);
  filter.appendChild(feColorMatrix2);
  filter.appendChild(feBlend1);
  filter.appendChild(feBlend2);

  defsEl.appendChild(filter);
  svg.appendChild(defsEl);

  const outerPin = document.createElementNS(svgNS, 'path');
  outerPin.setAttribute('fill-rule', 'evenodd');
  outerPin.setAttribute('clip-rule', 'evenodd');
  outerPin.setAttribute('d', 'M15 0C23.2843 0 30 6.71573 30 15C30 22.2574 24.846 28.311 17.9986 29.7002L15.466 33.3268C15.4135 33.4024 15.3437 33.464 15.2626 33.5066C15.1815 33.5492 15.0914 33.5714 15 33.5714C14.9086 33.5714 14.8185 33.5492 14.7374 33.5066C14.6563 33.464 14.5865 33.4024 14.534 33.3268L12.0014 29.7002C5.15398 28.311 0 22.2574 0 15C0 6.71573 6.71573 0 15 0Z');
  outerPin.setAttribute('fill', '#972689');
  svg.appendChild(outerPin);

  const bottomDot = document.createElementNS(svgNS, 'path');
  bottomDot.setAttribute('d', 'M16.7853 37.317C16.7853 36.3307 15.9858 35.5312 14.9996 35.5312C14.0134 35.5312 13.2139 36.3307 13.2139 37.317C13.2139 38.3032 14.0134 39.1027 14.9996 39.1027C15.9858 39.1027 16.7853 38.3032 16.7853 37.317Z');
  bottomDot.setAttribute('fill', '#972689');
  svg.appendChild(bottomDot);

  const innerPinG = document.createElementNS(svgNS, 'g');
  innerPinG.setAttribute('filter', 'url(#chabadShadow)');

  const innerPin = document.createElementNS(svgNS, 'path');
  innerPin.setAttribute('fill-rule', 'evenodd');
  innerPin.setAttribute('clip-rule', 'evenodd');
  innerPin.setAttribute('d', 'M15.084 4.26099C21.2072 4.26099 26.171 9.08811 26.171 15.0427C26.171 20.2591 22.3615 24.6103 17.3004 25.6089L15.4285 28.2156C15.3896 28.2699 15.3381 28.3142 15.2781 28.3448C15.2182 28.3754 15.1516 28.3914 15.084 28.3914C15.0165 28.3914 14.9499 28.3754 14.89 28.3448C14.83 28.3142 14.7784 28.2699 14.7396 28.2156L12.8677 25.6089C7.80653 24.6103 3.99707 20.2591 3.99707 15.0427C3.99707 9.08811 8.96087 4.26099 15.084 4.26099Z');
  innerPin.setAttribute('fill', '#1FBECA');
  innerPinG.appendChild(innerPin);
  svg.appendChild(innerPinG);

  const menorah = document.createElementNS(svgNS, 'path');
  menorah.setAttribute('d', 'M20.9529 20.9143C20.1302 21.9112 19.2138 22.7524 17.9106 23.1914C17.9048 22.78 17.8997 22.4163 17.8946 22.0527C17.8711 20.3781 17.8485 18.7034 17.8234 17.0288C17.8147 16.4428 17.3442 15.9547 16.7331 15.9369C15.829 15.9106 14.9222 15.8743 14.0199 15.9141C13.2365 15.9487 12.757 16.156 12.539 16.8844C12.5074 16.99 12.5079 17.1069 12.5093 17.2183C12.5351 19.1882 12.5633 21.1581 12.5914 23.1562C12.1583 23.222 11.8231 22.992 11.5266 22.8061C9.84126 21.7493 8.66807 20.348 8.27224 18.4035C7.99814 17.057 8.2241 15.8061 8.7923 14.5696C9.51228 13.0027 10.4787 11.5752 11.5245 10.1998C12.2893 9.19386 13.1562 8.25795 13.9812 7.29363C14.3243 6.89268 14.6767 6.49902 15.0277 6.09883C15.6361 6.75158 16.2359 7.36876 16.8041 8.01133C17.5584 8.86445 18.3072 9.72319 19.0235 10.6052C20.0085 11.8183 20.882 13.1045 21.5577 14.4993C22.225 15.8764 22.4183 17.3034 21.9927 18.7967C21.7756 19.5583 21.4083 20.2389 20.9529 20.9143Z');
  menorah.setAttribute('fill', '#FFCC00');
  svg.appendChild(menorah);

  return svg;
}
