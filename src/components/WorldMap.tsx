import { memo } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { feature } from 'topojson-client';
import worldData from 'world-atlas/countries-110m.json';

// ISO numeric (as returned by topojson feature.id) → ISO 3166-1 alpha-2
const NUM_TO_A2: Record<string, string> = {
  '4':'AF','8':'AL','12':'DZ','24':'AO','32':'AR','36':'AU','40':'AT','50':'BD',
  '56':'BE','64':'BT','68':'BO','72':'BW','76':'BR','84':'BZ','96':'BN',
  '100':'BG','104':'MM','116':'KH','120':'CM','124':'CA','140':'CF','144':'LK',
  '152':'CL','156':'CN','170':'CO','174':'KM','175':'YT','178':'CG','180':'CD',
  '188':'CR','191':'HR','192':'CU','196':'CY','203':'CZ','204':'BJ','208':'DK',
  '214':'DO','218':'EC','222':'SV','226':'GQ','231':'ET','232':'ER','233':'EE',
  '238':'FK','242':'FJ','246':'FI','250':'FR','258':'PF','262':'DJ','266':'GA',
  '270':'GM','276':'DE','288':'GH','296':'KI','300':'GR','308':'GD','320':'GT',
  '324':'GN','328':'GY','332':'HT','336':'VA','340':'HN','348':'HU','356':'IN',
  '360':'ID','364':'IR','368':'IQ','372':'IE','376':'IL','380':'IT','384':'CI',
  '388':'JM','392':'JP','398':'KZ','400':'JO','404':'KE','408':'KP','410':'KR',
  '414':'KW','417':'KG','418':'LA','422':'LB','426':'LS','430':'LR','434':'LY',
  '440':'LT','442':'LU','450':'MG','454':'MW','458':'MY','466':'ML','478':'MR',
  '480':'MU','484':'MX','496':'MN','504':'MA','508':'MZ','512':'OM','516':'NA',
  '524':'NP','528':'NL','548':'VU','554':'NZ','558':'NI','562':'NE','566':'NG',
  '578':'NO','583':'FM','584':'MH','585':'PW','586':'PK','591':'PA','598':'PG',
  '600':'PY','604':'PE','608':'PH','616':'PL','620':'PT','626':'TL','630':'PR',
  '634':'QA','642':'RO','643':'RU','646':'RW','659':'KN','662':'LC','670':'VC',
  '682':'SA','686':'SN','690':'SC','694':'SL','703':'SK','704':'VN','705':'SI',
  '706':'SO','710':'ZA','716':'ZW','724':'ES','729':'SD','740':'SR','752':'SE',
  '756':'CH','760':'SY','762':'TJ','764':'TH','768':'TG','776':'TO','780':'TT',
  '784':'AE','788':'TN','792':'TR','795':'TM','798':'TV','800':'UG','804':'UA',
  '818':'EG','826':'GB','840':'US','858':'UY','860':'UZ','862':'VE','882':'WS',
  '887':'YE','894':'ZM','90':'SB',
};

// Extract GeoJSON features once at module level (avoids CDN dependency)
const geographies = feature(
  worldData as never,
  (worldData as any).objects.countries
).features;

interface WorldMapProps {
  visitedCodes: string[];
}

export const WorldMap = memo(function WorldMap({ visitedCodes }: WorldMapProps) {
  const visitedSet = new Set(visitedCodes);
  return (
    <ComposableMap
      projection="geoMercator"
      projectionConfig={{ scale: 100, center: [10, 20] }}
      style={{ width: '100%', height: 'auto' }}
    >
      <Geographies geography={geographies}>
        {({ geographies: geos }) =>
          geos.map((geo) => {
            const iso2 = NUM_TO_A2[String(geo.id)] || '';
            const visited = iso2 ? visitedSet.has(iso2) : false;
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={visited ? '#F97316' : '#E5E7EB'}
                stroke="#ffffff"
                strokeWidth={0.4}
                style={{
                  default: { outline: 'none' },
                  hover: { outline: 'none' },
                  pressed: { outline: 'none' },
                }}
              />
            );
          })
        }
      </Geographies>
    </ComposableMap>
  );
});