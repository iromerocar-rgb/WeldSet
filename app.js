const $ = s => document.querySelector(s);
let process = "AUTO", joint = "BUTT";

const SOURCES = {
  E6013: {name:"ESAB OK 46.00 · AWS E6013", url:"https://esab.com/es/eur_es/products-solutions/product/filler-metals/mild-steel/stick-electrodes-smaw/ok-46-00/",
    polarity:"AC / DC±", ranges:[
      {d:1.6,min:30,max:60,v:26},{d:2.0,min:50,max:80,v:25},{d:2.5,min:60,max:100,v:22},{d:3.2,min:80,max:150,v:22},{d:4.0,min:100,max:230,v:22}
    ]},
  E7018: {name:"Lincoln Excalibur 7018-1 MR · AWS E7018-1 H4R", url:"https://ch-delivery.lincolnelectric.com/api/public/content/d0df5913fd7e4fef88756cee9dff7cfe?v=527d9351",
    polarity:"DC+ preferente / AC", ranges:[
      {d:2.4,min:70,max:110},{d:3.2,min:90,max:160},{d:4.0,min:130,max:210},{d:4.8,min:180,max:300}
    ]},
  E308L: {name:"ESAB OK 61.30 · E308L-17", url:"https://esab.com/ae/mea_en/products-solutions/product/filler-metals/stainless-steel/stick-electrodes-smaw/ok-61-30/",
    polarity:"DC+ / AC", ranges:[
      {d:1.6,min:35,max:45,v:27},{d:2.0,min:35,max:65,v:29},{d:2.5,min:50,max:90,v:31},{d:3.2,min:70,max:130,v:31},{d:4.0,min:90,max:180,v:32}
    ]},
  MIG_STEEL: {name:"ESAB OK AristoRod 12.50", url:"https://esab.com/es/eur_es/products-solutions/product/filler-metals/mild-steel/mig-wires-tig-rods-gmaw-gtaw/ok-aristorod-12-50/",
    ranges:[
      {d:.8,min:60,max:200,vmin:18,vmax:24,wmin:3.2,wmax:10.0},
      {d:.9,min:70,max:250,vmin:18,vmax:26,wmin:3.0,wmax:12.0},
      {d:1.0,min:80,max:300,vmin:18,vmax:32,wmin:2.7,wmax:15.0},
      {d:1.2,min:120,max:380,vmin:18,vmax:35,wmin:2.5,wmax:15.0}
    ]}
};

const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const round5 = x => Math.round(x/5)*5;
const fmt = x => Number.isInteger(x) ? String(x) : x.toFixed(1).replace(".",",");

document.querySelectorAll("[data-process]").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll("[data-process]").forEach(x=>x.classList.remove("active"));
  b.classList.add("active"); process=b.dataset.process;
}));
document.querySelectorAll("[data-joint]").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll("[data-joint]").forEach(x=>x.classList.remove("active"));
  b.classList.add("active"); joint=b.dataset.joint;
}));

$("#aboutBtn").onclick=()=>$("#aboutDialog").showModal();
$("#closeAbout").onclick=()=>$("#aboutDialog").close();
$("#calculateBtn").onclick=calculate;

function chooseProcess(mat,t,intent){
  if(mat==="ALU") return t<=5 ? "TIG":"MIG";
  if(t<=1.8) return "TIG";
  if(t<=5) return "MIG";
  if(intent==="STRUCTURAL") return "MMA";
  return "MIG";
}
function thicknessFactor(){
  return {BUTT:1.0,TEE:1.10,LAP:1.06,CORNER:1.05}[joint]||1;
}
function positionFactor(pos){
  return {FLAT:1,HORIZONTAL:.96,VERTICAL:.90,OVERHEAD:.86}[pos]||1;
}
function effectiveThickness(t1,t2){
  const mn=Math.min(t1,t2), mx=Math.max(t1,t2);
  return mn + Math.min((mx-mn)*0.18, mn*0.25);
}
function chooseSmawDiameter(t,key){
  if(key==="E7018"){
    if(t<=4) return 2.4;
    if(t<=8) return 3.2;
    if(t<=14) return 4.0;
    return 4.8;
  }
  if(t<=1.7) return 1.6;
  if(t<=2.6) return 2.0;
  if(t<=4.2) return 2.5;
  if(t<=8.0) return 3.2;
  return 4.0;
}
function makeTrace(title,text){return {title,text}}
function calcMMA(mat,t,pos,intent,maxA){
  if(mat==="ALU"){
    return {error:"Para aluminio, esta versión no recomienda MMA: la selección del electrodo revestido de aluminio depende mucho de aleación y producto. Usa TIG AC o MIG con argón."};
  }
  let key = mat==="STEEL" ? (intent==="STRUCTURAL"?"E7018":"E6013") : "E308L";
  if(mat==="SS316") key="E308L";
  const src=SOURCES[key];
  let d=chooseSmawDiameter(t,key);
  let r=src.ranges.reduce((a,b)=>Math.abs(b.d-d)<Math.abs(a.d-d)?b:a);
  let base = r.min + .46*(r.max-r.min);
  base *= thicknessFactor()*positionFactor(pos);
  if(intent==="ROOT") base*=.96;
  if(intent==="APPEARANCE") base*=.92;
  let amp=round5(clamp(base,r.min,r.max));
  let warnings=[];
  if(amp>maxA) warnings.push(`Tu límite indicado (${maxA} A) queda por debajo del ajuste calculado. Baja diámetro, usa varias pasadas o cambia de proceso.`);
  if(Math.min(+$("#t1").value,+$("#t2").value)<2 && d>=2) warnings.push("Riesgo alto de perforación en chapa fina con MMA. TIG o MIG suelen dar más control térmico.");
  if(mat==="SS316") warnings.push("Para inoxidable 316/316L, selecciona un consumible 316L compatible (p. ej. E316L-16/-17) y usa la ficha exacta del fabricante. Aquí no se extrapola E308L como equivalencia metalúrgica.");
  if(key==="E7018" && t<3) warnings.push("E7018 en espesores finos exige control de arco y aporte térmico; considera MIG/TIG si buscas minimizar deformación.");
  return {
    process:"MMA / electrodo revestido",
    consumable:key==="E6013"?"E6013 · rutilo":key==="E7018"?"E7018 · bajo hidrógeno":"E308L · inoxidable",
    diameter:`Ø ${fmt(r.d)} mm`,
    amp, min:r.min,max:r.max,
    polarity:src.polarity,
    voltage:r.v?`${r.v} V (dato de depósito)`:"Depende del arco",
    aux1Label:"Longitud de arco", aux1:"≈ diámetro del núcleo",
    aux2Label:"Pasadas", aux2:t>8?"Múltiples":"1–2 según unión",
    source:src.name, sourceUrl:src.url,
    confidence: key==="E7018"||key==="E6013"||mat==="SS304" ? "Alta" : "Media",
    warnings,
    guidance:[
      "Empieza en el amperaje indicado y haz una probeta del mismo espesor. Corrige en pasos de 5 A.",
      pos==="VERTICAL"||pos==="OVERHEAD" ? "La posición seleccionada reduce el punto de partida para controlar el baño. Mantén arco corto." : "Mantén un arco corto y estable; no alargues el arco para compensar falta de corriente.",
      key==="E7018" ? "Respeta almacenamiento y reacondicionado del electrodo según el fabricante; la ventaja del bajo hidrógeno depende de ello." : "Limpia óxido, pintura y grasa en la zona inmediata del cordón."
    ],
    trace:[
      makeTrace("Rango de corriente","Tomado directamente de la tabla del consumible del fabricante."),
      makeTrace("Diámetro recomendado","Heurística por espesor efectivo y control de perforación; no es un dato normativo."),
      makeTrace("Ajuste inicial","Interpolación dentro del rango del fabricante, corregida por tipo de unión y posición.")
    ]
  };
}
function chooseMigRange(t){
  if(t<=4) return SOURCES.MIG_STEEL.ranges[0];
  if(t<=6) return SOURCES.MIG_STEEL.ranges[1];
  if(t<=10) return SOURCES.MIG_STEEL.ranges[2];
  return SOURCES.MIG_STEEL.ranges[3];
}
function calcMIG(mat,t,pos,intent,maxA){
  let warnings=[];
  let consumable, gas;
  if(mat==="STEEL"){consumable="ER70S-6 / G3Si1"; gas="M21 · Ar/CO₂";}
  else if(mat==="SS304"){consumable="ER308LSi"; gas="Ar + 1–3% CO₂/O₂";}
  else if(mat==="SS316"){consumable="ER316LSi"; gas="Ar + 1–3% CO₂/O₂";}
  else {consumable="ER4043 o ER5356*"; gas="Argón 100%";}
  let r=chooseMigRange(t);
  if(mat==="ALU" && r.d<1.0) r=SOURCES.MIG_STEEL.ranges[2];
  let amp = 39.37*t*thicknessFactor()*positionFactor(pos);
  if(intent==="APPEARANCE") amp*=.92;
  amp=round5(clamp(amp,r.min,r.max));
  const frac=clamp((amp-r.min)/(r.max-r.min),0,1);
  const volts=(r.vmin+frac*(r.vmax-r.vmin));
  const wfs=(r.wmin+frac*(r.wmax-r.wmin));
  if(amp>maxA) warnings.push(`El punto de partida (${amp} A) supera el máximo indicado de tu máquina (${maxA} A). Usa varias pasadas, menor hilo o un proceso compatible.`);
  if(mat!=="STEEL") warnings.push("En inoxidable/aluminio, A/V/WFS se muestran como estimación de arranque; valida con la tabla del hilo y la máquina concretos. La tabla ESAB incorporada para A/V/WFS es de acero al carbono.");
  if(mat==="ALU") warnings.push("*ER4043 vs ER5356 depende de la aleación base, servicio y acabado/anodizado. No se debe escoger sólo por espesor.");
  return {
    process:"MIG/MAG · hilo continuo",
    consumable,diameter:`Ø ${fmt(r.d)} mm`,
    amp,min:r.min,max:r.max,
    polarity:"DC+ (DCEP)",
    voltage:`${volts.toFixed(1).replace(".",",")} V inicial`,
    aux1Label:"Velocidad hilo",aux1:`${wfs.toFixed(1).replace(".",",")} m/min`,
    aux2Label:"Gas",aux2:gas,
    source:SOURCES.MIG_STEEL.name,sourceUrl:SOURCES.MIG_STEEL.url,
    confidence:mat==="STEEL"?"Alta":"Media",
    warnings,
    guidance:[
      "Haz una probeta y ajusta primero velocidad de hilo/corriente; después afina la tensión para estabilizar longitud de arco y perfil.",
      "Mantén constante el stick-out. Cambiarlo altera corriente, penetración y estabilidad aunque el panel de la máquina no cambie.",
      mat==="STEEL"?"Para acero, limpia cascarilla, pintura y grasa; M21 ofrece un buen compromiso para transferencia por cortocircuito/mixta.":"Usa gas y liner/rodillos adecuados al material; evita contaminación cruzada."
    ],
    trace:[
      makeTrace("Rango de hilo","A/V/WFS limitados por la tabla ESAB OK AristoRod 12.50 para cada diámetro."),
      makeTrace("Corriente por espesor","Punto de partida basado en la guía Miller MIG: aprox. 1 A por 0,001 in de espesor, con correcciones de unión/posición."),
      makeTrace("Voltaje y WFS","Interpolados dentro de los rangos publicados por ESAB para el diámetro seleccionado.")
    ]
  };
}
function calcTIG(mat,t,pos,intent,maxA){
  let warnings=[];
  const alu=mat==="ALU";
  let ampPerMm = alu ? 45 : 37.5;
  let amp=ampPerMm*t*thicknessFactor()*positionFactor(pos);
  if(intent==="APPEARANCE") amp*=.90;
  amp=round5(clamp(amp,10,alu?300:250));
  let tung = amp<=70?1.0:amp<=150?1.6:amp<=235?2.4:3.2;
  let filler = amp<50?"≤ 1,6":amp<100?"1,0–2,4":amp<200?"1,6–3,2":"2,4–4,0";
  let consumable;
  if(mat==="STEEL") consumable="ER70S-2 / ER70S-6";
  else if(mat==="SS304") consumable="ER308L";
  else if(mat==="SS316") consumable="ER316L";
  else consumable="ER4043 / ER5356*";
  if(amp>maxA) warnings.push(`El pico calculado (${amp} A) supera tu máximo indicado (${maxA} A). Para TIG esto limita especialmente espesores altos.`);
  if(alu) warnings.push("*La varilla 4043/5356 debe seleccionarse por aleación base y requisitos de servicio, no sólo por espesor.");
  return {
    process:alu?"TIG AC · aluminio":"TIG DC · acero/inoxidable",
    consumable,diameter:`Varilla ${filler} mm`,
    amp,min:Math.max(10,round5(amp*.82)),max:round5(amp*1.12),
    polarity:alu?"AC · balance según óxido/máquina":"DCEN · electrodo negativo",
    voltage:"Controlada por longitud de arco",
    aux1Label:"Tungsteno",aux1:`Ø ${fmt(tung)} mm · 2% lantano`,
    aux2Label:"Gas",aux2:"Argón 100%",
    source:"Miller TIG guidance / tungsten ranges",sourceUrl:"https://www.millerwelds.com/en-us/resources/knowledge-hub/tig-welding/how-to/guide-to-tig-welding-basics",
    confidence:"Media",
    warnings,
    guidance:[
      "Usa pedal/remote si está disponible y considera el valor mostrado como corriente máxima de partida, no obligación de mantenerla.",
      alu?"Retira óxido con cepillo inoxidable exclusivo para aluminio y desengrasa antes de soldar.":"Afilado longitudinal del tungsteno; arco corto y aportación regular.",
      "Ajusta caudal de argón a la copa y condiciones de aire. Más caudal no siempre mejora la protección y puede inducir turbulencia."
    ],
    trace:[
      makeTrace("Tungsteno","Diámetro seleccionado para mantener la corriente dentro de rangos típicos publicados por Miller."),
      makeTrace("Corriente","Estimación de arranque basada en espesor y práctica TIG; se marca como heurística, no como tabla de un consumible concreto."),
      makeTrace("Aporte","Familia de varilla elegida por material base; la compatibilidad metalúrgica final depende de la aleación exacta.")
    ]
  };
}
function prepText(t1,t2){
  const mn=Math.min(t1,t2);
  if(joint==="BUTT"){
    if(mn<=3) return "A tope: borde recto; prueba holgura pequeña sólo si necesitas penetración.";
    if(mn<=6) return "A tope: considera separación de raíz y/o bisel ligero según penetración requerida.";
    return "A tope: normalmente requiere preparación de borde y varias pasadas; define geometría con un WPS.";
  }
  if(joint==="TEE") return "En T: filete. El tamaño resistente del cordón no puede deducirse sólo del espesor; depende de cargas y criterio de diseño.";
  if(joint==="LAP") return "Solape: controla separación entre chapas y acceso al pie del cordón. El tamaño del filete requiere cálculo si es estructural.";
  return "Esquina: controla ajuste y riesgo de quemado del borde libre; una secuencia corta reduce deformación.";
}
function calculate(){
  const mat=$("#material").value, t1=+$("#t1").value, t2=+$("#t2").value;
  const pos=$("#position").value, intent=$("#intent").value, maxA=+$("#maxA").value;
  if(!t1||!t2||t1<=0||t2<=0){alert("Introduce espesores válidos.");return;}
  const te=effectiveThickness(t1,t2);
  let p=process==="AUTO"?chooseProcess(mat,te,intent):process;
  let r=p==="MMA"?calcMMA(mat,te,pos,intent,maxA):p==="MIG"?calcMIG(mat,te,pos,intent,maxA):calcTIG(mat,te,pos,intent,maxA);
  if(r.error){alert(r.error);return;}
  render(r,t1,t2,te);
}
function render(r,t1,t2,te){
  $("#result").classList.remove("hidden");
  $("#rProcess").textContent=r.process;
  $("#confidence").textContent=`Confianza ${r.confidence.toLowerCase()}`;
  $("#rConsumable").textContent=r.consumable;
  $("#rDiameter").textContent=r.diameter;
  $("#rAmp").textContent=r.amp;
  $("#rRange").textContent=`Rango de referencia ${r.min}–${r.max} A`;
  $("#meterMin").textContent=`${r.min} A`; $("#meterMax").textContent=`${r.max} A`;
  const pct=clamp((r.amp-r.min)/(r.max-r.min)*100,0,100);
  $("#meterFill").style.width=`${pct}%`; $("#meterPin").style.left=`calc(${pct}% - 1px)`;
  const params=[
    ["Polaridad",r.polarity,"configuración de partida"],
    ["Tensión / arco",r.voltage,"según proceso"],
    [r.aux1Label,r.aux1,"valor inicial"],
    [r.aux2Label,r.aux2,"verifica consumible"]
  ];
  $("#paramGrid").innerHTML=params.map(x=>`<div class="param"><span class="label">${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join("");
  const guides=[...r.guidance,prepText(t1,t2)];
  $("#guidance").innerHTML=guides.map((g,i)=>`<div class="guide-row"><span class="guide-num">${i+1}</span><p>${g}</p></div>`).join("");
  const wb=$("#warningBox");
  if(r.warnings.length){wb.classList.remove("hidden");wb.innerHTML="<strong>Atención</strong><br>"+r.warnings.join("<br><br>");}else wb.classList.add("hidden");
  const extra=makeTrace("Espesor efectivo",`La lógica usa ${fmt(te)} mm para controlar el aporte térmico en piezas de ${fmt(t1)} y ${fmt(t2)} mm; pondera principalmente la pieza más fina.`);
  $("#trace").innerHTML=[extra,...r.trace].map(x=>`<div class="trace-row"><span class="dot"></span><div><strong>${x.title}</strong><p>${x.text}</p></div></div>`).join("");
  $("#traceBadge").textContent=r.confidence==="Alta"?"fabricante + cálculo":"fabricante + heurística";
  $("#result").scrollIntoView({behavior:"smooth",block:"start"});
}
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
}
