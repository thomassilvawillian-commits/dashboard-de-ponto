/*************************************************************
 * Controle de Ponto — painel exclusivo da gerente de RH
 * Apps Script vinculado à planilha. Consulte PASSO_A_PASSO.md.
 * Funções terminadas em _ são privadas, inacessíveis pelo app.
 *************************************************************/
const SH_FUNC='Funcionarios', SH_REG='Registros';
const TIPOS=['ENTRADA','SAIDA_INTERVALO','RETORNO_INTERVALO','SAIDA'];
const DIAS_SEMANA=['DOM','SEG','TER','QUA','QUI','SEX','SAB'];
const REG_COLS=['Timestamp','FuncionarioID','Nome','Data','Tipo','Origem','Status','Observacao','SolicitacaoID','SolicitadoEm','DecididoPor','DecididoEm'];
const RH_ID_KEY='PONTO_GERENTE_RH_ID', SESSION_SECONDS=21600;

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate().setTitle('Controle de Ponto').addMetaTag('viewport','width=device-width, initial-scale=1');
}
function include(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }

/* Configuração feita dentro da planilha pelo responsável. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Controle de Ponto').addItem('Configurar conta exclusiva de RH','configurarGerenteRH_').addToUi();
}
function configurarGerenteRH_() {
  const ui=SpreadsheetApp.getUi();
  const nome=ui.prompt('Conta exclusiva de RH','Informe o nome de login da gerente (ex.: GERENTE RH).',ui.ButtonSet.OK_CANCEL);
  if (nome.getSelectedButton()!==ui.Button.OK) return;
  const pin=ui.prompt('PIN da gerente','Defina um PIN de exatamente 4 números. Anote-o para entregar à gerente.',ui.ButtonSet.OK_CANCEL);
  if (pin.getSelectedButton()!==ui.Button.OK) return;
  const confirma=ui.prompt('Confirme o PIN','Digite novamente o PIN escolhido.',ui.ButtonSet.OK_CANCEL);
  if (confirma.getSelectedButton()!==ui.Button.OK) return;
  if (pin.getResponseText().trim()!==confirma.getResponseText().trim()) { ui.alert('Os PINs não conferem. Nenhuma conta foi alterada.'); return; }
  const decisao=ui.alert('Confirmar acesso exclusivo','O nome informado será a única conta com acesso ao painel de RH. Se esse nome já existir, seu PIN será atualizado e a conta receberá esse acesso. Continuar?',ui.ButtonSet.YES_NO);
  if (decisao!==ui.Button.YES) return;
  try {
    const conta=configurarContaRH_(nome.getResponseText(),pin.getResponseText());
    ui.alert('Conta configurada: '+conta.nome+'\nEntre no mesmo link do sistema com esse nome e o PIN definido. O painel de RH abrirá automaticamente.');
  } catch (e) { ui.alert(e.message || String(e)); }
}
function configurarContaRH_(nome,pin) {
  nome=nomeNormalizado_(nome); pin=String(pin || '').trim();
  if (!nomeValido_(nome)) throw new Error('Informe um nome de login válido, com 2 a 100 caracteres.');
  const erro=erroPin_(pin); if (erro) throw new Error(erro);
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    prepararEstruturaRH_();
    const rows=getFuncRows_(), sh=SpreadsheetApp.getActive().getSheetByName(SH_FUNC);
    const header=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(h=>String(h).trim());
    let f=rows.find(r=>nomeNormalizado_(r.Nome)===nome);
    if (!f) {
      f=novoFuncionario_(rows,nome,pin,'RH');
      sh.appendRow(header.map(h=>f[h]==null?'':f[h]));
    } else {
      sh.getRange(f._row,header.indexOf('PIN')+1).setNumberFormat('@').setValue(hashPin_(pin));
      sh.getRange(f._row,header.indexOf('Nivel')+1).setValue('RH');
      sh.getRange(f._row,header.indexOf('Ativo')+1).setValue(1);
    }
    PropertiesService.getScriptProperties().setProperty(RH_ID_KEY,String(f.ID));
    CacheService.getScriptCache().remove('login:'+digest_(nome));
    return {id:String(f.ID),nome:f.Nome};
  } finally { lock.releaseLock(); }
}
function ensureFuncExtras_() {
  const sh=SpreadsheetApp.getActive().getSheetByName(SH_FUNC);
  if (!sh) throw new Error('Aba Funcionarios não encontrada.');
  const header=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(h=>String(h).trim());
  ['DataInicio','SaldoInicialMin','DataFim'].forEach(h=>{
    if (header.indexOf(h)<0) { sh.getRange(1,header.length+1).setValue(h); header.push(h); }
  });
  return {sh:sh,header:header};
}
function prepararEstruturaRH_() {
  const info=ensureFuncExtras_(), todos=agruparTodos_(getRegRows_());
  getFuncRows_().forEach(f=>{
    if (!f.DataInicio) {
      const primeiro=Object.keys(todos[String(f.ID)] || {}).sort()[0] || ymd(new Date());
      info.sh.getRange(f._row,info.header.indexOf('DataInicio')+1).setNumberFormat('@').setValue(primeiro);
    }
    if (f.SaldoInicialMin==='' || f.SaldoInicialMin==null) info.sh.getRange(f._row,info.header.indexOf('SaldoInicialMin')+1).setValue(0);
  });
}
function novoFuncionario_(rows,nome,pin,nivel) {
  return {ID:rows.reduce((m,r)=>Math.max(m,Number(r.ID)||0),0)+1,Nome:nome,PIN:hashPin_(pin),Nivel:nivel,
    Entrada:'09:00',SaidaAlmoco:'12:00',RetornoAlmoco:'13:00',Saida:'18:00',JornadaDiariaHoras:8,
    DiasTrabalho:'SEG,TER,QUA,QUI,SEX',Ativo:1,DataInicio:ymd(new Date()),SaldoInicialMin:0,DataFim:''};
}

/* Identidade sempre validada no servidor, a partir de sessão aleatória. */
function erroPin_(pin) {
  const s=String(pin==null?'':pin).trim();
  if (!/^\d*$/.test(s)) return 'O PIN deve ter apenas números.';
  if (!s) return 'Informe seu PIN.';
  return s.length!==4?'O PIN deve ter exatamente 4 números.':null;
}
function nomeNormalizado_(n) { return String(n || '').trim().toUpperCase(); }
function nomeValido_(n) { return n.length>=2 && n.length<=100 && !/^[=+@\-]/.test(n); }
function digest_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s),Utilities.Charset.UTF_8).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}
function hashPin_(pin) { const salt=Utilities.getUuid(); return 'sha256$'+salt+'$'+digest_(salt+':'+pin); }
function pinDaPlanilha_(v) { const s=String(v==null?'':v).trim(); return /^\d{1,3}$/.test(s)?s.padStart(4,'0'):s; }
function conferePin_(f,pin) {
  const valor=String(f.PIN || '');
  if (valor.indexOf('sha256$')===0) { const p=valor.split('$'); return p[2]===digest_(p[1]+':'+pin); }
  return pinDaPlanilha_(f.PIN)===pin;
}
function rhId_() { return PropertiesService.getScriptProperties().getProperty(RH_ID_KEY) || ''; }
function temAcessoRH_(f) { return f.Ativo==1 && String(f.Nivel).toUpperCase()==='RH' && String(f.ID)===rhId_(); }
function perfil_(f) {
  const rh=temAcessoRH_(f);
  return {id:String(f.ID),nome:String(f.Nome),nivel:rh?'RH':'FUNCIONARIO',acessoRH:rh,
    entrada:horaPlanilha_(f.Entrada),saidaAlmoco:horaPlanilha_(f.SaidaAlmoco),retornoAlmoco:horaPlanilha_(f.RetornoAlmoco),saida:horaPlanilha_(f.Saida),jornadaHoras:jornadaMin_(f)/60,diasTrabalho:diasTrabalho_(f)};
}
function criarSessao_(f) {
  const token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,''), expires=Date.now()+SESSION_SECONDS*1000;
  CacheService.getScriptCache().put('sess:'+token,JSON.stringify({id:String(f.ID),expires:expires,cred:digest_(String(f.PIN))}),SESSION_SECONDS);
  return {ok:true,token:token,expires:expires,funcionario:perfil_(f)};
}
function autenticar_(token,rh) {
  const falha='SESSAO_EXPIRADA: Entre novamente para continuar.';
  if (!/^[a-f0-9]{64}$/.test(String(token || ''))) throw new Error(falha);
  const raw=CacheService.getScriptCache().get('sess:'+token); if (!raw) throw new Error(falha);
  const sess=JSON.parse(raw), f=getFuncById_(sess.id);
  if (!f || f.Ativo!=1 || sess.expires<=Date.now() || sess.cred!==digest_(String(f.PIN))) throw new Error(falha);
  if (rh && !temAcessoRH_(f)) throw new Error('Acesso exclusivo da gerente de RH.');
  return f;
}
function login(nome,pin) {
  nome=nomeNormalizado_(nome); pin=String(pin==null?'':pin).trim();
  if (!nome) return {ok:false,error:'Digite seu nome.'};
  const erro=erroPin_(pin); if (erro) return {ok:false,error:erro};
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const cache=CacheService.getScriptCache(), key='login:'+digest_(nome);
    let contador=JSON.parse(cache.get(key) || '{"tentativas":0,"ate":0}');
    if (contador.ate<Date.now()) contador={tentativas:0,ate:Date.now()+900000};
    if (contador.tentativas>=5) return {ok:false,error:'Muitas tentativas. Aguarde até 15 minutos para tentar novamente.'};
    const f=getFuncRows_().find(r=>nomeNormalizado_(r.Nome)===nome);
    if (!f || f.Ativo!=1 || !conferePin_(f,pin)) {
      contador.tentativas++;
      cache.put(key,JSON.stringify(contador),Math.max(1,Math.ceil((contador.ate-Date.now())/1000)));
      return {ok:false,error:'Nome ou PIN incorreto, ou cadastro inativo.'};
    }
    cache.remove(key); return criarSessao_(f);
  } finally { lock.releaseLock(); }
}
function getSessao(token) { return {ok:true,funcionario:perfil_(autenticar_(token,false))}; }
function sair(token) { if (/^[a-f0-9]{64}$/.test(String(token || ''))) CacheService.getScriptCache().remove('sess:'+token); return {ok:true}; }
function criarConta(nome,pin,confirmPin) {
  nome=nomeNormalizado_(nome); pin=String(pin || '').trim();
  if (!nomeValido_(nome)) return {ok:false,error:'Informe um nome válido, com 2 a 100 caracteres.'};
  const erro=erroPin_(pin); if (erro) return {ok:false,error:erro};
  if (pin!==String(confirmPin || '').trim()) return {ok:false,error:'Os PINs digitados não são iguais.'};
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const rows=getFuncRows_();
    if (rows.some(f=>nomeNormalizado_(f.Nome)===nome)) return {ok:false,error:'Já existe uma conta com esse nome. Use Entrar ou fale com o RH.'};
    const info=ensureFuncExtras_(), f=novoFuncionario_(rows,nome,pin,'FUNCIONARIO');
    info.sh.appendRow(info.header.map(h=>f[h]==null?'':f[h])); return criarSessao_(f);
  } finally { lock.releaseLock(); }
}

/* Ponto e consultas pessoais: nenhum ID informado pelo navegador é usado. */
function statusHoje(token) {
  const f=autenticar_(token,false), marks=getRegistrosDia_(f.ID,ymd(new Date()),true);
  return {marcacoes:marks,proximo:TIPOS.find(t=>marks.indexOf(t)<0) || null,dataServidor:new Date().toISOString()};
}
function baterPonto(token) {
  const f=autenticar_(token,false), lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const now=new Date(), hoje=ymd(now), marks=getRegistrosDia_(f.ID,hoje,true), tipo=TIPOS.find(t=>marks.indexOf(t)<0);
    if (!tipo) return {ok:false,error:'Todas as marcações de hoje já foram feitas.'};
    appendRegistro_({timestamp:now.toISOString(),funcionarioId:f.ID,nome:f.Nome,data:hoje,tipo:tipo,origem:'web',status:'APROVADO',observacao:'',solicitacaoId:'',solicitadoEm:now.toISOString(),decididoPor:'',decididoEm:''});
    return {ok:true,tipo:tipo,hora:hhmm(now),dataServidor:now.toISOString()};
  } finally { lock.releaseLock(); }
}
function solicitarManual(token,dataISO,tipo,hora,observacao) {
  const f=autenticar_(token,false);
  if (!dataValida_(dataISO) || dataISO>ymd(new Date())) return {ok:false,error:'Informe uma data válida até hoje.'};
  if (TIPOS.indexOf(tipo)<0 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(hora))) return {ok:false,error:'Informe uma marcação e um horário válidos.'};
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const registros=getTodosRegistros_(f.ID,true)[dataISO] || [];
    if (registros.some(r=>r.tipo===tipo)) return {ok:false,error:'Essa marcação já existe nesse dia.'};
    const ts=Utilities.parseDate(dataISO+' '+hora,tz_(),'yyyy-MM-dd HH:mm');
    if (ts>new Date()) return {ok:false,error:'Não é possível registrar um horário futuro.'};
    const idx=TIPOS.indexOf(tipo);
    if (registros.some(r=>(TIPOS.indexOf(r.tipo)<idx && new Date(r.ts)>ts) || (TIPOS.indexOf(r.tipo)>idx && new Date(r.ts)<ts))) return {ok:false,error:'O horário deve respeitar a ordem das marcações do dia.'};
    const id=Utilities.getUuid(), agora=new Date().toISOString();
    appendRegistro_({timestamp:ts.toISOString(),funcionarioId:f.ID,nome:f.Nome,data:dataISO,tipo:tipo,origem:'manual',status:'APROVADO',observacao:String(observacao || '').slice(0,300),solicitacaoId:id,solicitadoEm:agora,decididoPor:'',decididoEm:''});
    return {ok:true,solicitacaoId:id};
  } finally { lock.releaseLock(); }
}
function minhasSolicitacoes(token) {
  const f=autenticar_(token,false);
  return getRegRows_().filter(r=>String(r.FuncionarioID)===String(f.ID) && r.Origem==='manual')
    .sort((a,b)=>new Date(b.SolicitadoEm)-new Date(a.SolicitadoEm)).slice(0,30)
    .map(r=>({solicitacaoId:String(r.SolicitacaoID),data:dataPlanilha_(r.Data),tipo:r.Tipo,hora:hhmm(new Date(r.Timestamp)),status:r.Status,observacao:String(r.Observacao || '')}));
}
function cancelarSolicitacao(token,id) {
  const f=autenticar_(token,false); if (!String(id || '').trim()) return {ok:false,error:'Lançamento inválido.'};
  const lock=LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const sh=ensureRegHeader_(), data=sh.getDataRange().getValues(), h=data[0].map(String);
    for (let i=1;i<data.length;i++) {
      if (String(data[i][h.indexOf('SolicitacaoID')])===String(id) && String(data[i][h.indexOf('FuncionarioID')])===String(f.ID) && data[i][h.indexOf('Origem')]==='manual') { sh.deleteRow(i+1); return {ok:true}; }
    }
    return {ok:false,error:'Lançamento não encontrado.'};
  } finally { lock.releaseLock(); }
}
function getMeuMes(token,anoMes) { const f=autenticar_(token,false); validarMes_(anoMes); return {ok:true,resumo:montarResumoMes_(f,anoMes)}; }

/* Painel, detalhes e exportação: exclusivos da única conta RH configurada. */
function getPainelGestor(token,anoMes) {
  autenticar_(token,true); validarMes_(anoMes);
  const registros=agruparTodos_(getRegRows_()), hoje=ymd(new Date());
  const equipe=getFuncRows_().map(f=>{
    const todos=registros[String(f.ID)] || {}, r=montarResumoMes_(f,anoMes,todos,hoje), banco=montarBanco_(f,anoMes,todos,hoje);
    return {id:String(f.ID),nome:String(f.Nome),ativo:f.Ativo==1,rh:temAcessoRH_(f),diasTrabalhados:r.diasTrabalhados,faltas:r.faltas,
      atrasoMin:r.atrasoTotalMin,extraMin:r.extraTotalMin,faltanteMin:r.faltanteTotalMin,trabalhadoMin:r.trabalhadoTotalMin,previstoMin:r.previstoTotalMin,
      saldoMin:r.saldoTotalMin,bancoMin:banco.saldoMin,bancoPendencias:banco.incompletos,incompletos:r.incompletos,
      dataInicio:r.dataInicio,dataFim:r.dataFim,saldoInicialMin:banco.saldoInicialMin};
  }).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  return {ok:true,equipe:equipe,anoMes:anoMes,hoje:hoje,atualizadoEm:new Date().toISOString()};
}
function getFuncionarioMesGestor(token,id,anoMes) {
  autenticar_(token,true); validarMes_(anoMes);
  const f=getFuncById_(id); if (!f) return {ok:false,error:'Funcionário não encontrado.'};
  return {ok:true,resumo:montarResumoMes_(f,anoMes)};
}
function getRelatorioMensal(token,anoMes) {
  autenticar_(token,true); validarMes_(anoMes);
  const registros=agruparTodos_(getRegRows_()), linhas=[];
  getFuncRows_().forEach(f=>montarResumoMes_(f,anoMes,registros[String(f.ID)] || {}).dias.forEach(d=>linhas.push(Object.assign({nome:String(f.Nome),funcionarioId:String(f.ID),ativo:f.Ativo==1},d))));
  return {ok:true,linhas:linhas};
}

/* Horas extras e faltantes: totais brutos, antes da compensação. */
function validarMes_(m) { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(m)) || Number(m.slice(0,4))<1900 || Number(m.slice(0,4))>2100) throw new Error('Mês inválido.'); }
function jornadaMin_(f) {
  const n=Number(String(f.JornadaDiariaHoras==null?'':f.JornadaDiariaHoras).replace(',','.'));
  return Math.round((Number.isFinite(n) && n>=0 && f.JornadaDiariaHoras!=='' && f.JornadaDiariaHoras!=null?n:8)*60);
}
function diasTrabalho_(f) { return String(f.DiasTrabalho==null?'SEG,TER,QUA,QUI,SEX':f.DiasTrabalho).split(',').map(s=>s.trim().toUpperCase()); }
function periodo_(f,todos,hoje) {
  const datas=Object.keys(todos).sort(), inicio=dataPlanilha_(f.DataInicio) || datas[0] || hoje;
  const fim=dataPlanilha_(f.DataFim) || (f.Ativo!=1?(datas[datas.length-1] || inicio):'');
  return {inicio:inicio,fim:fim};
}
function calcularDia_(f,data,marks,periodo,hoje) {
  const diaSemana=DIAS_SEMANA[new Date(data+'T12:00:00Z').getUTCDay()], esperado=diasTrabalho_(f).indexOf(diaSemana)>=0, jornada=esperado?jornadaMin_(f):0;
  const futuro=data>hoje, fora=data<periodo.inicio || (!!periodo.fim && data>periodo.fim), porTipo={}, quantidade={};
  marks.forEach(m=>{ quantidade[m.tipo]=(quantidade[m.tipo]||0)+1; porTipo[m.tipo]=new Date(m.ts); });
  const vals=TIPOS.map(t=>porTipo[t] || null), presentes=vals.filter(Boolean);
  const valido=presentes.every(d=>Number.isFinite(d.getTime())) && presentes.every((d,i)=>i===0 || d>=presentes[i-1]) && Object.keys(quantidade).every(t=>TIPOS.indexOf(t)>=0 && quantidade[t]===1);
  const completo=valido && presentes.length===4;
  let trabalhado=0;
  if (valido) [[0,1],[2,3]].forEach(p=>{ if (vals[p[0]] && vals[p[1]]) trabalhado+=(vals[p[1]]-vals[p[0]])/60000; });
  trabalhado=Math.max(0,Math.round(trabalhado));
  const status=fora?'fora_periodo':futuro?'futuro':completo?'completo':marks.length?'incompleto':esperado?(data<hoje?'falta':'aguardando'):'folga';
  const saldo=status==='completo'?trabalhado-jornada:status==='falta'?-jornada:0, entradaEsperada=hmsToSeconds_(f.Entrada);
  const atraso=(!fora && !futuro && valido && vals[0] && esperado && entradaEsperada!=null)?Math.max(0,Math.round((dateToSecondsOfDay_(vals[0])-entradaEsperada)/60)):0;
  const considerar=!fora && !futuro;
  return {data:data,diaSemana:diaSemana,esperado:esperado,status:status,
    entrada:vals[0] && Number.isFinite(vals[0].getTime())?hhmm(vals[0]):null,
    saidaIntervalo:vals[1] && Number.isFinite(vals[1].getTime())?hhmm(vals[1]):null,
    retornoIntervalo:vals[2] && Number.isFinite(vals[2].getTime())?hhmm(vals[2]):null,
    saida:vals[3] && Number.isFinite(vals[3].getTime())?hhmm(vals[3]):null,
    totalTrabalhadoMin:considerar?trabalhado:0,jornadaEsperadaMin:considerar?jornada:0,atrasoMin:atraso,saldoMin:saldo,extraMin:Math.max(0,saldo),faltanteMin:Math.max(0,-saldo)};
}
function montarResumoMes_(f,anoMes,todos,hoje) {
  validarMes_(anoMes); todos=todos || getTodosRegistros_(f.ID,true); hoje=hoje || ymd(new Date());
  const periodo=periodo_(f,todos,hoje), partes=anoMes.split('-').map(Number), ultimo=new Date(Date.UTC(partes[0],partes[1],0)).getUTCDate();
  const r={funcionarioId:String(f.ID),nome:String(f.Nome),anoMes:anoMes,dias:[],dataInicio:periodo.inicio,dataFim:periodo.fim,
    diasTrabalhados:0,faltas:0,incompletos:0,atrasoTotalMin:0,extraTotalMin:0,faltanteTotalMin:0,saldoTotalMin:0,trabalhadoTotalMin:0,previstoTotalMin:0};
  for (let d=1;d<=ultimo;d++) {
    const data=anoMes+'-'+pad_(d), dia=calcularDia_(f,data,todos[data] || [],periodo,hoje); r.dias.push(dia);
    if (dia.status==='completo') r.diasTrabalhados++; if (dia.status==='falta') r.faltas++; if (dia.status==='incompleto') r.incompletos++;
    r.atrasoTotalMin+=dia.atrasoMin; r.extraTotalMin+=dia.extraMin; r.faltanteTotalMin+=dia.faltanteMin;
    r.saldoTotalMin+=dia.saldoMin; r.trabalhadoTotalMin+=dia.totalTrabalhadoMin; r.previstoTotalMin+=dia.jornadaEsperadaMin;
  }
  return r;
}
function montarBanco_(f,anoMes,todos,hoje) {
  const p=periodo_(f,todos,hoje), partes=anoMes.split('-').map(Number), finalMes=anoMes+'-'+pad_(new Date(Date.UTC(partes[0],partes[1],0)).getUTCDate());
  const limite=[finalMes,hoje,p.fim || '9999-12-31'].sort()[0], inicial=Number(String(f.SaldoInicialMin || 0).replace(',','.')) || 0;
  const r={saldoMin:limite<p.inicio?0:Math.round(inicial),saldoInicialMin:Math.round(inicial),incompletos:0};
  if (limite<p.inicio) return r;
  let data=p.inicio;
  while (data<=limite) {
    const dia=calcularDia_(f,data,todos[data] || [],p,hoje); r.saldoMin+=dia.saldoMin; if (dia.status==='incompleto') r.incompletos++;
    const prox=new Date(data+'T12:00:00Z'); prox.setUTCDate(prox.getUTCDate()+1); data=prox.toISOString().slice(0,10);
  }
  return r;
}

/* Planilha: leitura em lote e preservação de cabeçalhos e dados. */
function getFuncRows_() {
  const sh=SpreadsheetApp.getActive().getSheetByName(SH_FUNC); if (!sh) throw new Error('Aba Funcionarios não encontrada.');
  const values=sh.getDataRange().getValues(), header=values.shift().map(h=>String(h).trim());
  return values.map((r,i)=>{ const o={_row:i+2}; header.forEach((h,k)=>o[h]=r[k]); return o; }).filter(r=>r.ID!=='' && r.ID!=null);
}
function getFuncById_(id) { return getFuncRows_().find(f=>String(f.ID)===String(id)) || null; }
function ensureRegHeader_() {
  const sh=SpreadsheetApp.getActive().getSheetByName(SH_REG); if (!sh) throw new Error('Aba Registros não encontrada.');
  const first=sh.getRange(1,1,1,REG_COLS.length).getValues()[0].map(h=>String(h).trim());
  if (!REG_COLS.every((c,i)=>first[i]===c)) throw new Error('Confira os cabeçalhos da aba Registros. Consulte o passo a passo.');
  return sh;
}
function appendRegistro_(o) {
  const obs=String(o.observacao || '');
  ensureRegHeader_().appendRow([o.timestamp,o.funcionarioId,o.nome,o.data,o.tipo,o.origem,o.status,/^[=+@\-]/.test(obs)?"'"+obs:obs,o.solicitacaoId,o.solicitadoEm,o.decididoPor,o.decididoEm]);
}
function getRegRows_() {
  const sh=ensureRegHeader_(), last=sh.getLastRow(); if (last<2) return [];
  return sh.getRange(2,1,last-1,REG_COLS.length).getValues().filter(r=>r[1]!=='' && r[1]!=null).map(r=>{ const o={}; REG_COLS.forEach((h,i)=>o[h]=r[i]); return o; });
}
function agruparTodos_(rows,apenasAprovado) {
  const out={};
  rows.forEach(r=>{
    if (apenasAprovado!==false && r.Status!=='APROVADO') return;
    const id=String(r.FuncionarioID), data=dataPlanilha_(r.Data); if (!data) return;
    if (!out[id]) out[id]={}; if (!out[id][data]) out[id][data]=[];
    out[id][data].push({tipo:String(r.Tipo),ts:r.Timestamp instanceof Date?r.Timestamp.toISOString():String(r.Timestamp),status:String(r.Status)});
  });
  return out;
}
function getTodosRegistros_(id,apenasAprovado) { return agruparTodos_(getRegRows_(),apenasAprovado)[String(id)] || {}; }
function getRegistrosDia_(id,data,apenasAprovado) { return (getTodosRegistros_(id,apenasAprovado)[data] || []).map(r=>r.tipo); }

/* O fuso da planilha define o dia e o horário de toda a apuração. */
let FUSO_PONTO_;
function tz_() { if (!FUSO_PONTO_) FUSO_PONTO_=SpreadsheetApp.getActive().getSpreadsheetTimeZone(); return FUSO_PONTO_; }
function ymd(d) { return Utilities.formatDate(d,tz_(),'yyyy-MM-dd'); }
function hhmm(d) { return Utilities.formatDate(d,tz_(),'HH:mm'); }
function pad_(n) { return String(n).padStart(2,'0'); }
function dataValida_(s) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false; const d=new Date(s+'T12:00:00Z'); return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===s; }
function dataPlanilha_(v) { if (v instanceof Date) return ymd(v); const s=String(v || '').trim(); return dataValida_(s)?s:''; }
function horaPlanilha_(v) { return v instanceof Date?hhmm(v):String(v==null?'':v); }
function dateToSecondsOfDay_(d) { const p=Utilities.formatDate(d,tz_(),'HH:mm:ss').split(':').map(Number); return p[0]*3600+p[1]*60+p[2]; }
function hmsToSeconds_(v) { if (v instanceof Date) return dateToSecondsOfDay_(v); const m=String(v || '').match(/^(\d{1,2}):(\d{2})/); return m?Number(m[1])*3600+Number(m[2])*60:null; }
