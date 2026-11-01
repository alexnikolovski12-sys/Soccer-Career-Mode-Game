// Real clubs and squads — 2026/27 season (after the summer 2026 window, which
// closed 1–2 September 2026). Ratings use the EA FC 27 launch ratings where
// known (the top 100) and are estimates in the same style for everyone else.
// Faces and hair are generated, not scanned. Format per player:
//   "Name|POS|NATION|OVR|flags"
//   name:  "First Last"; an underscore joins a multi-word surname ("Virgil van_Dijk");
//          a single word is a mononym ("Pedri")
//   flags: d = darker skin, m = mid skin, L = left-footed, f = rapid, s = not quick
// Kits: primary, secondary, pattern, shorts, socks.

const W = '#f2f4f8', B = '#14161c';

export const SQUADS_SEASON = '2026/27';

export const REAL_CLUBS = {
  ENG: [
    ['Arsenal', 'ARS', ['#d6202b', W, 'sleeves', W, '#d6202b'], `
      David Raya|GK|ESP|88; Kepa Arrizabalaga|GK|ESP|79; Illan Meslier|GK|FRA|76; William Saliba|CB|FRA|88|d;
      Gabriel Magalhães|CB|BRA|89|mL; Ezri Konsa|CB|ENG|83|d; Cristhian Mosquera|CB|ESP|77|d; Jurriën Timber|RB|NED|84|d;
      Ben White|RB|ENG|81; Piero Hincapié|LB|ECU|83|dL; Riccardo Calafiori|LB|ITA|82|L; Myles Lewis-Skelly|LB|ENG|78|dL;
      Declan Rice|CDM|ENG|88; Martín Zubimendi|CDM|ESP|84; Bruno Guimarães|CM|BRA|86|ms; Mikel Merino|CM|ESP|82|Ls;
      Martin Ødegaard|CAM|NOR|86|Ls; Eberechi Eze|CAM|ENG|84|d; Bukayo Saka|RW|ENG|87|dL; Noni Madueke|RW|ENG|80|dLf;
      Christos Tzolis|LW|GRE|80|f; Viktor Gyökeres|ST|SWE|86; Kai Havertz|ST|GER|82|L`],
    ['Manchester City', 'MCI', ['#6cabdd', W, 'plain', W, '#6cabdd'], `
      Gianluigi Donnarumma|GK|ITA|89; Gerónimo Rulli|GK|ARG|81; Rúben Dias|CB|POR|87; Marc Guéhi|CB|ENG|85|d;
      Joško Gvardiol|CB|CRO|85|L; Vitor Reis|CB|BRA|74|m; Rayan Aït-Nouri|LB|ALG|82|mL; Matheus Nunes|RB|POR|80|m;
      Rico Lewis|RB|ENG|78|d; Ayyoub Bouaddi|CDM|FRA|79|m; Mateo Kovačić|CM|CRO|81|s; Elliot Anderson|CM|ENG|83;
      Enzo Fernández|CM|ARG|86; Allan Elias|CM|BRA|75|m; Phil Foden|CAM|ENG|84|L; Rayan Cherki|RW|FRA|86|m;
      Antoine Semenyo|RW|GHA|85|df; Jérémy Doku|LW|BEL|84|df; Iliman Ndiaye|LW|SEN|81|df; Erling Haaland|ST|NOR|91|Lf`],
    ['Liverpool', 'LIV', ['#c8102e', W, 'plain', '#c8102e', '#c8102e'], `
      Alisson|GK|BRA|87; Giorgi Mamardashvili|GK|GEO|81; Virgil van_Dijk|CB|NED|88|d; Ronald Araújo|CB|URU|82|d;
      Jérémy Jacquet|CB|FRA|79|d; Joe Gomez|CB|ENG|78|d; Jeremie Frimpong|RB|NED|83|df; Milos Kerkez|LB|HUN|81|L;
      Ryan Gravenberch|CDM|NED|85|d; Wataru Endo|CDM|JPN|77; Alexis Mac_Allister|CM|ARG|84; Dominik Szoboszlai|CAM|HUN|86;
      Florian Wirtz|CAM|GER|86; Federico Chiesa|RW|ITA|77; Bradley Barcola|LW|FRA|85|df; Cody Gakpo|LW|NED|84|m;
      Víctor Muñoz|LW|ESP|79|f; Alexander Isak|ST|SWE|86|d; Hugo Ekitiké|ST|FRA|85|d`],
    ['Chelsea', 'CHE', ['#034694', W, 'plain', '#034694', W], `
      Emiliano Martínez|GK|ARG|85; Mike Penders|GK|BEL|72; Maxence Lacroix|CB|FRA|81|d; Levi Colwill|CB|ENG|81|L;
      Wesley Fofana|CB|FRA|80|d; Jorrel Hato|CB|NED|78|dL; Reece James|RB|ENG|84|d; Malo Gusto|RB|FRA|80|d;
      Marco Palestra|RB|ITA|78|f; Valentín Barco|LB|ARG|77|L; Pep Chavarría|LB|ESP|76|L; Moisés Caicedo|CDM|ECU|86|d;
      Roméo Lavia|CDM|BEL|78|d; Jordan Henderson|CDM|ENG|76|s; Cole Palmer|CAM|ENG|85|L; Morgan Rogers|CAM|ENG|83|d;
      Estêvão|RW|BRA|81|mL; Geovany Quenda|RW|POR|79|dLf; Pedro Neto|LW|POR|81|Lf; João Pedro|ST|BRA|83|m;
      Emmanuel Emegha|ST|NED|77|d; Danny Welbeck|ST|ENG|75|d`],
    ['Manchester United', 'MUN', ['#da291c', B, 'plain', W, B], `
      Senne Lammens|GK|BEL|78; Karl Darlow|GK|WAL|70; Matthijs de_Ligt|CB|NED|82; Lisandro Martínez|CB|ARG|83|L;
      Leny Yoro|CB|FRA|80|d; Harry Maguire|CB|ENG|77|s; Ayden Heaven|CB|ENG|73|dL; Luke Shaw|LB|ENG|79|L;
      Patrick Dorgu|LB|DEN|77|dLf; Diogo Dalot|RB|POR|80; Noussair Mazraoui|RB|MAR|79|m; Carlos Baleba|CDM|CMR|82|d;
      Manuel Ugarte|CDM|URU|78; Kobbie Mainoo|CM|ENG|80|d; Andrey Santos|CM|BRA|79|m; Youri Tielemans|CM|BEL|85|s;
      Bruno Fernandes|CAM|POR|89; Mason Mount|CAM|ENG|77; Bryan Mbeumo|RW|CMR|84|dL; Amad Diallo|RW|CIV|80|dL;
      Matheus Cunha|LW|BRA|84|m; Marcus Rashford|LW|ENG|81|df; Benjamin Šeško|ST|SVN|81`],
    ['Tottenham Hotspur', 'TOT', [W, '#132257', 'plain', '#132257', W], `
      Martin Dúbravka|GK|SVK|77; Antonín Kinský|GK|CZE|74; Micky van_de_Ven|CB|NED|84|Lf; Jan Paul van_Hecke|CB|NED|81|d;
      Marcos Senesi|CB|ARG|79|L; Tosin Adarabioyo|CB|ENG|76|d; Pedro Porro|RB|ESP|82; Destiny Udogie|LB|ITA|80|dL;
      Andrew Robertson|LB|SCO|80|L; Sandro Tonali|CDM|ITA|85; Rodrigo Bentancur|CM|URU|79; Mateus Fernandes|CM|POR|81;
      Lucas Bergvall|CM|SWE|77; Archie Gray|CM|ENG|75; James Maddison|CAM|ENG|80; Xavi Simons|CAM|NED|83|d;
      Mohammed Kudus|RW|GHA|83|dL; Savinho|RW|BRA|81|mL; Dejan Kulusevski|RW|SWE|80|L; Brennan Johnson|RW|WAL|79|mf;
      Mykhailo Mudryk|LW|UKR|77|f; Wilson Odobert|LW|FRA|74|d; Omar Marmoush|ST|EGY|83|m; Dominic Solanke|ST|ENG|80|d;
      Richarlison|ST|BRA|78|d`],
    ['Newcastle United', 'NEW', [B, W, 'stripes', B, B], `
      Nick Pope|GK|ENG|82; Lukáš Horníček|GK|CZE|74; Ewen Jaouen|GK|FRA|73; Sven Botman|CB|NED|81|L;
      Malick Thiaw|CB|GER|81|d; Fabian Schär|CB|SUI|79|s; Dan Burn|CB|ENG|79|Ls; Tino Livramento|RB|ENG|80|d;
      Amar Dedić|RB|BIH|78; Lewis Hall|LB|ENG|79|L; Nico González|CDM|ESP|80; Joelinton|CM|BRA|82|ms;
      Jacob Ramsey|CM|ENG|77; Sean Steur|CM|NED|74; Joe Willock|CM|ENG|76|d; Anthony Elanga|RW|SWE|79|df;
      Matías Fernández-Pardo|RW|BEL|79; Harvey Barnes|LW|ENG|78; Bazoumana Touré|LW|CIV|77|df; Yoane Wissa|ST|COD|80|d;
      William Osula|ST|DEN|72|d`],
    ['Aston Villa', 'AVL', ['#7a1e3c', '#95bfe5', 'sleeves', W, '#7a1e3c'], `
      Zion Suzuki|GK|JPN|78|d; Marco Bizot|GK|NED|76; Pau Torres|CB|ESP|80|L; Victor Lindelöf|CB|SWE|78|s;
      Tyrone Mings|CB|ENG|78|dL; Taylor Harwood-Bellis|CB|ENG|77; Modou Keba_Cissé|CB|SEN|73|d; Matty Cash|RB|POL|79;
      Aaron Wan-Bissaka|RB|ENG|78|d; Ian Maatsen|LB|NED|78|dL; Matteo Ruggeri|LB|ITA|78|L; Boubacar Kamara|CDM|FRA|82|d;
      Amadou Onana|CDM|BEL|79|d; João Gomes|CDM|BRA|80|m; Leon Goretzka|CM|GER|81|s; John McGinn|CM|SCO|80|L;
      Johan Manzambi|CM|SUI|78|d; Emiliano Buendía|CAM|ARG|77; Alejandro Garnacho|LW|ARG|80|f; Ibrahim Mbaye|LW|SEN|74|df;
      Nicolas Jackson|ST|SEN|81|d`],
  ],
  ESP: [
    ['Real Madrid', 'RMA', [W, '#d4af37', 'plain', W, W], `
      Thibaut Courtois|GK|BEL|90; Andriy Lunin|GK|UKR|78; Ibrahima Konaté|CB|FRA|85|d; Antonio Rüdiger|CB|GER|84|d;
      Éder Militão|CB|BRA|83|m; Dean Huijsen|CB|ESP|83|L; Raúl Asencio|CB|ESP|77; Trent Alexander-Arnold|RB|ENG|85;
      Denzel Dumfries|RB|NED|83|d; Marc Cucurella|LB|ESP|86|L; Álvaro Carreras|LB|ESP|82|L; Ferland Mendy|LB|FRA|80|dL;
      Aurélien Tchouaméni|CDM|FRA|85|d; Federico Valverde|CM|URU|87; Eduardo Camavinga|CM|FRA|84|dL; Bernardo Silva|CM|POR|85|Ls;
      Jude Bellingham|CAM|ENG|90|d; Arda Güler|CAM|TUR|84|L; Brahim Díaz|CAM|MAR|79|m; Yan Diomande|RW|CIV|84|df;
      Rodrygo|RW|BRA|84|d; Vinícius_Jr.|LW|BRA|89|df; Kylian Mbappé|ST|FRA|91|df; Endrick|ST|BRA|78|dL;
      Carlos Espí|ST|ESP|74`],
    ['FC Barcelona', 'BAR', ['#a50044', '#004d98', 'stripes', '#004d98', '#a50044'], `
      Joan García|GK|ESP|86; Dominik Livaković|GK|CRO|79; Pau Cubarsí|CB|ESP|86; Eric García|CB|ESP|85;
      Andreas Christensen|CB|DEN|78|s; Jules Koundé|RB|FRA|85|d; Alejandro Balde|LB|ESP|82|dLf; Gerard Martín|LB|ESP|76|L;
      Rodri|CDM|ESP|90|s; Marc Bernal|CDM|ESP|74; Pedri|CM|ESP|90; Frenkie de_Jong|CM|NED|86;
      Gavi|CM|ESP|82; Fermín López|CAM|ESP|82; Dani Olmo|CAM|ESP|83; Lamine Yamal|RW|ESP|90|mL;
      Raphinha|LW|BRA|88|mL; Anthony Gordon|LW|ENG|83|f; Karim Adeyemi|LW|GER|80|df; Gabriel Jesus|ST|BRA|79|m`],
    ['Atlético de Madrid', 'ATM', ['#cb3524', W, 'stripes', '#1c2c5b', '#cb3524'], `
      Jan Oblak|GK|SVN|88; Juan Musso|GK|ARG|77; Cristian Romero|CB|ARG|85; Robin Le_Normand|CB|ESP|81;
      Dávid Hancko|CB|SVK|81|L; Marc Pubill|CB|ESP|77; Marcos Llorente|RB|ESP|85|f; Alejandro Grimaldo|LB|ESP|85|L;
      Morten Hjulmand|CDM|DEN|83; Johnny Cardoso|CDM|USA|79|m; Koke|CM|ESP|80|s; Pablo Barrios|CM|ESP|82;
      Conor Gallagher|CM|ENG|80; Álex Baena|CAM|ESP|83|L; Lee Kang-in|CAM|KOR|80|L; Giuliano Simeone|RW|ARG|80;
      Julián Álvarez|ST|ARG|86; Jonathan David|ST|CAN|82|d; Alexander Sørloth|ST|NOR|81|s`],
    ['Athletic Club', 'ATH', ['#ee2523', W, 'stripes', B, B], `
      Unai Simón|GK|ESP|85; Julen Agirrezabala|GK|ESP|74; Aymeric Laporte|CB|ESP|81|L; Dani Vivian|CB|ESP|81;
      Aitor Paredes|CB|ESP|77; Yuri Berchiche|LB|ESP|77|L; Óscar de_Marcos|RB|ESP|76; Jesús Areso|RB|ESP|78;
      Mikel Jauregizar|CM|ESP|80; Iñigo Ruiz_de_Galarreta|CM|ESP|78; Unai Vencedor|CM|ESP|75; Oihan Sancet|CAM|ESP|82;
      Nico Williams|LW|ESP|85|df; Robert Navarro|LW|ESP|76|L; Álvaro Djaló|LW|POR|74|d; Álex Berenguer|RW|ESP|78;
      Iñaki Williams|RW|GHA|81|df; Gorka Guruzeta|ST|ESP|79; Maroan Sannadi|ST|ESP|74|m`],
    ['Villarreal', 'VIL', ['#ffe114', '#005187', 'plain', '#ffe114', '#ffe114'], `
      Péter Gulácsi|GK|HUN|79; Luiz Júnior|GK|BRA|79|m; Renato Veiga|CB|POR|80|L; Juan Foyth|CB|ARG|79;
      Santiago Mouriño|RB|URU|78; Sergi Cardona|LB|ESP|77|L; Carlos Romero|LB|ESP|74|L; Pape Gueye|CDM|SEN|79|d;
      Santi Comesaña|CM|ESP|79; Alberto Moleiro|CAM|ESP|81|L; Nicolas Pépé|RW|CIV|79|dL; Ilias Akhomach|RW|MAR|73|mL;
      Tajon Buchanan|LW|CAN|76|df; Ayoze Pérez|ST|ESP|80; Gerard Moreno|ST|ESP|79|Ls; Georges Mikautadze|ST|GEO|79;
      Tani Oluwaseyi|ST|CAN|74|d`],
    ['Real Sociedad', 'RSO', ['#0067b1', W, 'stripes', W, '#0067b1'], `
      Álex Remiro|GK|ESP|83; Unai Marrero|GK|ESP|72; Igor Zubeldia|CB|ESP|79; Jon Pacheco|CB|ESP|76|L;
      Jon Martín|CB|ESP|74; Mamadou Sarr|CB|FRA|74|d; Jon Aramburu|RB|VEN|77; Héctor Fort|RB|ESP|74;
      Sergio Gómez|LB|ESP|78|L; Jon Gorrotxategi|CDM|ESP|76; Luka Sučić|CM|CRO|78|L; Beñat Turrientes|CM|ESP|77;
      Carlos Soler|CM|ESP|79; Takefusa Kubo|RW|JPN|81|L; Ander Barrenetxea|LW|ESP|79; Mikel Oyarzabal|ST|ESP|83|L;
      Orri Óskarsson|ST|ISL|75; Carlos Fernández|ST|ESP|72`],
  ],
  GER: [
    ['FC Bayern München', 'FCB', ['#dc052d', W, 'plain', '#dc052d', '#dc052d'], `
      Manuel Neuer|GK|GER|84; Jonas Urbig|GK|GER|76; Dayot Upamecano|CB|FRA|87|d; Jonathan Tah|CB|GER|87|d;
      Kim Min-jae|CB|KOR|83; Alphonso Davies|LB|CAN|82|dLf; Nathaniel Brown|LB|GER|80|dL; Konrad Laimer|RB|AUT|85;
      Josip Stanišić|RB|CRO|79; Joshua Kimmich|CDM|GER|88|s; Aleksandar Pavlović|CDM|GER|83; Jamal Musiala|CAM|GER|87|m;
      Ismael Saibari|CAM|MAR|81|mL; Lennart Karl|CAM|GER|74|L; Michael Olise|RW|FRA|90|dL; Serge Gnabry|RW|GER|81|m;
      Luis Díaz|LW|COL|88|mf; Harry Kane|ST|ENG|90|s`],
    ['Borussia Dortmund', 'BVB', ['#fde100', B, 'plain', B, '#fde100'], `
      Gregor Kobel|GK|SUI|87; Alexander Meyer|GK|GER|71; Nico Schlotterbeck|CB|GER|87|L; Waldemar Anton|CB|GER|81;
      Ramy Bensebaini|LB|ALG|77|mL; Daniel Svensson|LB|SWE|78|L; Julian Ryerson|RB|NOR|79; Pascal Groß|CDM|GER|79|s;
      Felix Nmecha|CM|GER|85|d; Marcel Sabitzer|CM|AUT|79; Joey Veerman|CM|NED|79|s; Jobe Bellingham|CM|ENG|78|d;
      Ethan Nwaneri|CAM|ENG|77|dL; Carney Chukwuemeka|CAM|AUT|76|d; Konstantinos Karetsas|CAM|BEL|74|L; Giannis Konstantelias|CAM|GRE|74;
      Maximilian Beier|ST|GER|79; Serhou Guirassy|ST|GUI|85|d`],
    ['Bayer 04 Leverkusen', 'B04', ['#e32221', B, 'plain', B, '#e32221'], `
      Mark Flekken|GK|NED|79; Janis Blaswich|GK|GER|72; Edmond Tapsoba|CB|BFA|82|d; Loïc Badé|CB|FRA|79|d;
      Jarell Quansah|CB|ENG|79|d; Miguel Gutiérrez|LB|ESP|80|L; Facundo Medina|LB|ARG|79|L; Guéla Doué|RB|CIV|77|d;
      Robert Andrich|CDM|GER|79|s; Aleix García|CM|ESP|80|s; Ibrahim Maza|CAM|ALG|78|m; Malik Tillman|CAM|USA|79|d;
      Moussa Diaby|RW|FRA|80|df; Martin Terrier|LW|FRA|79; Afonso Moreira|LW|POR|73; Patrik Schick|ST|CZE|82|Ls;
      Victor Boniface|ST|NGA|78|d; Christian Kofane|ST|CMR|73|d`],
    ['RB Leipzig', 'RBL', [W, '#dd0741', 'plain', W, W], `
      Maarten Vandevoordt|GK|BEL|76; Ørjan Nyland|GK|NOR|75; Willi Orbán|CB|HUN|79; Castello Lukeba|CB|FRA|81|dL;
      Maxime Estève|CB|FRA|78|L; David Raum|LB|GER|81|L; Ridle Baku|RB|GER|77|d; Nicolas Seiwald|CDM|AUT|79;
      Neil El_Aynaoui|CM|MAR|78|m; Rocco Reitz|CM|GER|77; Assan Ouédraogo|CM|GER|76|d; Christoph Baumgartner|CAM|AUT|81;
      Antonio Nusa|LW|NOR|78|df; Johan Bakayoko|RW|BEL|77|dL; Brajan Gruda|RW|GER|77; Christopher Nkunku|ST|FRA|80|d;
      Marc Guiu|ST|ESP|74; Rômulo|ST|BRA|73|m`],
    ['Eintracht Frankfurt', 'SGE', [B, '#e1000f', 'plain', B, B], `
      Noah Atubolu|GK|GER|79; Kauã Santos|GK|BRA|77|m; Robin Koch|CB|GER|79; Lilian Brassier|LB|FRA|76|dL;
      Nnamdi Collins|CB|GER|75|d; Aurelio Buta|RB|POR|75|d; Raphael Onyedika|CDM|NGA|78|d; Noel Aseko|CM|GER|72|d;
      Mario Götze|CAM|GER|77|s; Can Uzun|CAM|TUR|79; Farès Chaïbi|CAM|ALG|78|m; Ritsu Dōan|RW|JPN|79|L;
      Ansgar Knauff|RW|GER|77|f; Jonathan Burkardt|ST|GER|80`],
  ],
  ITA: [
    ['Inter', 'INT', ['#0068a8', B, 'stripes', B, B], `
      Ivan Provedel|GK|ITA|80; Josep Martínez|GK|ESP|77; Alessandro Bastoni|CB|ITA|86|L; Manuel Akanji|CB|SUI|84|d;
      John Stones|CB|ENG|81; Yann Bisseck|CB|GER|80|d; Djed Spence|RB|ENG|79|d; Federico Dimarco|LB|ITA|86|L;
      Hakan Çalhanoğlu|CDM|TUR|85|s; Nicolò Barella|CM|ITA|87; Henrikh Mkhitaryan|CM|ARM|81|s; Curtis Jones|CM|ENG|80|d;
      Piotr Zieliński|CM|POL|79; Petar Sučić|CM|CRO|77; Aleksandar Stanković|CM|SRB|76; Luis Henrique|RW|BRA|77|mL;
      Lautaro Martínez|ST|ARG|87; Marcus Thuram|ST|FRA|85|d; Ange-Yoan Bonny|ST|FRA|78|d; Francesco Pio_Esposito|ST|ITA|75`],
    ['AC Milan', 'MIL', ['#e2231a', B, 'stripes', W, B], `
      Mike Maignan|GK|FRA|87|d; Pietro Terracciano|GK|ITA|72; Fikayo Tomori|CB|ENG|80|df; Mario Gila|CB|ESP|80;
      Matteo Gabbia|CB|ITA|79; Strahinja Pavlović|CB|SRB|78|L; Koni De_Winter|CB|BEL|77|d; Pervis Estupiñán|LB|ECU|78|dL;
      Davide Bartesaghi|LB|ITA|74|L; Alexis Saelemaekers|RB|BEL|80; Ardon Jashari|CDM|SUI|78; Luka Modrić|CM|CRO|85|s;
      Adrien Rabiot|CM|FRA|85|L; Ruben Loftus-Cheek|CM|ENG|78|d; Christian Pulisic|RW|USA|84; Omari Hutchinson|RW|ENG|78|mL;
      Diego Moreira|LW|BEL|76|d; Gonçalo Ramos|ST|POR|81`],
    ['Juventus', 'JUV', [W, B, 'stripes', B, W], `
      Guglielmo Vicario|GK|ITA|83; Kamil Grabara|GK|POL|76; Bremer|CB|BRA|86|m; Jhon Lucumí|CB|COL|80|dL;
      Federico Gatti|CB|ITA|80; Lloyd Kelly|CB|ENG|77|L; Pierre Kalulu|RB|FRA|81|d; Andrea Cambiaso|LB|ITA|83;
      Juan Cabal|LB|COL|75|dL; Manuel Locatelli|CDM|ITA|82|s; Khéphren Thuram|CM|FRA|81|d; Teun Koopmeiners|CM|NED|81|L;
      Pape Matar_Sarr|CM|SEN|80|d; Weston McKennie|CM|USA|79; Kenan Yıldız|LW|TUR|85; Jérémie Boga|LW|CIV|77|df;
      Francisco Conceição|RW|POR|81|L; Edon Zhegrova|RW|KOS|79|L; Randal Kolo_Muani|ST|FRA|80|d; Nick Woltemade|ST|GER|81;
      Jeff Ekhator|ST|ITA|72|d`],
    ['Napoli', 'NAP', ['#12a0d7', W, 'plain', W, '#12a0d7'], `
      Alex Meret|GK|ITA|80|L; Vanja Milinković-Savić|GK|SRB|80; Alessandro Buongiorno|CB|ITA|83|L; Amir Rrahmani|CB|KOS|81;
      Sam Beukema|CB|NED|79|L; Benoît Badiashile|CB|FRA|77|dL; Giovanni Di_Lorenzo|RB|ITA|83; Mathías Olivera|LB|URU|79|L;
      Stanislav Lobotka|CDM|SVK|83|s; Frank Anguissa|CM|CMR|82|d; Scott McTominay|CM|SCO|86; Billy Gilmour|CM|SCO|79;
      Kevin De_Bruyne|CAM|BEL|85|s; Matteo Politano|RW|ITA|79|L; David Neres|LW|BRA|80|mL; Noa Lang|LW|NED|80|d;
      Alisson Santos|LW|BRA|76|m; Rasmus Højlund|ST|DEN|81|L`],
    ['Atalanta', 'ATA', ['#1e71b8', B, 'stripes', B, B], `
      Marco Carnesecchi|GK|ITA|86; Marco Sportiello|GK|ITA|72; Berat Djimsiti|CB|ALB|79; Isak Hien|CB|SWE|80|d;
      Odilon Kossounou|CB|CIV|78|d; Thomas Kristensen|CB|DEN|76; Sead Kolašinac|CB|BIH|76|L; Raoul Bellanova|RB|ITA|78|df;
      Davide Zappacosta|RB|ITA|76; Nicola Zalewski|LB|POL|76|L; Franck Kessié|CDM|CIV|79|d; Éderson|CM|BRA|83|m;
      Mario Pašalić|CM|CRO|78|s; Gianluca Gaetano|CAM|ITA|76; Charles De_Ketelaere|CAM|BEL|84|L; Lazar Samardžić|CAM|SRB|76|L;
      Ademola Lookman|LW|NGA|83|d; Jonathan Rowe|LW|ENG|76|df; Nikola Krstović|ST|MNE|79; Gianluca Scamacca|ST|ITA|78|s`],
    ['AS Roma', 'ROM', ['#8e1f2f', '#f0bc42', 'plain', '#8e1f2f', '#8e1f2f'], `
      Mile Svilar|GK|SRB|85; Pierluigi Gollini|GK|ITA|72; Gianluca Mancini|CB|ITA|82; Evan Ndicka|CB|CIV|81|dL;
      Leonardo Balerdi|CB|ARG|80; Konstantinos Koulierakis|CB|GRE|77|L; Mario Hermoso|LB|ESP|78|L; Nahuel Molina|RB|ARG|80;
      Wesley|RB|BRA|79|m; Zeki Çelik|RB|TUR|76; Marten de_Roon|CDM|NED|79|s; Bryan Cristante|CDM|ITA|78|s;
      Manu Koné|CM|FRA|82|d; Lorenzo Pellegrini|CAM|ITA|79; Rodrigo Mora|CAM|POR|78; Paulo Dybala|CAM|ARG|85|Ls;
      Matías Soulé|RW|ARG|81|L; Stephan El_Shaarawy|LW|ITA|76|m; Donyell Malen|ST|NED|81|mf; Santiago Castro|ST|ARG|76`],
  ],
  FRA: [
    ['Paris Saint-Germain', 'PSG', ['#004170', '#da291c', 'centre', '#004170', '#004170'], `
      Lucas Chevalier|GK|FRA|83; Matvey Safonov|GK|RUS|77; Marquinhos|CB|BRA|87|m; Willian Pacho|CB|ECU|89|dL;
      Lucas Beraldo|CB|BRA|79|L; Achraf Hakimi|RB|MAR|88|mf; Nuno Mendes|LB|POR|89|dLf; Lucas Hernández|LB|FRA|81|L;
      Lucas Digne|LB|FRA|78|L; Vitinha|CM|POR|90; João Neves|CM|POR|88; Fabián Ruiz|CM|ESP|86|L;
      Warren Zaïre-Emery|CM|FRA|82|d; Senny Mayulu|CM|FRA|76|d; Maghnes Akliouche|CAM|FRA|83|mL; Désiré Doué|RW|FRA|86|d;
      Khvicha Kvaratskhelia|LW|GEO|89; Mika Godts|LW|BEL|78|Lf; Ousmane Dembélé|ST|FRA|90|df; Ferran Torres|ST|ESP|81`],
    ['Olympique de Marseille', 'OM', [W, '#2faee0', 'plain', W, W], `
      Jeffrey de_Lange|GK|NED|74; CJ Egan-Riley|CB|ENG|75|d; Nayef Aguerd|CB|MAR|79|mL; Derek Cornelius|CB|CAN|75|d;
      Emerson Palmieri|LB|ITA|76|L; Amir Murillo|RB|PAN|77|d; Pierre-Emile Højbjerg|CDM|DEN|81|s; Matt O'Riley|CM|DEN|79|L;
      Ismaël Koné|CM|CAN|76|d; Hamed Junior_Traorè|CAM|CIV|77|d; Amine Harit|CAM|MAR|76|m; Timothy Weah|RW|USA|78|df;
      Amine Gouiri|LW|ALG|81|m; Igor Paixão|LW|BRA|79|mL; Neal Maupay|ST|FRA|74`],
    ['AS Monaco', 'ASM', ['#e51b22', W, 'halves', W, '#e51b22'], `
      Lukáš Hrádecký|GK|FIN|79; Philipp Köhn|GK|SUI|78; Mohammed Salisu|CB|GHA|79|dL; Eric Dier|CB|ENG|77|s;
      Flávio Nazinho|LB|POR|73|L; Vanderson|RB|BRA|80|m; Jordan Teze|RB|NED|76|d; Denis Zakaria|CDM|SUI|82|d;
      Lamine Camara|CM|SEN|81|d; Paul Pogba|CM|FRA|78|d; Takumi Minamino|CAM|JPN|79; Eliesse Ben_Seghir|LW|MAR|79|mL;
      Ansu Fati|LW|ESP|76|d; Folarin Balogun|ST|USA|80|d; Matthis Abline|ST|FRA|79|d; Mika Biereth|ST|DEN|78|L`],
  ],
  POR: [
    ['SL Benfica', 'SLB', ['#e30613', W, 'plain', W, '#e30613'], `
      Anatoliy Trubin|GK|UKR|83; Samuel Soares|GK|POR|72; Nicolás Otamendi|CB|ARG|79|s; Tomás Araújo|CB|POR|80;
      Clément Lenglet|CB|FRA|77|L; Alessandro Circati|CB|AUS|76; Samuel Dahl|LB|SWE|77|L; Souffian El_Karouani|LB|MAR|74|mL;
      João Palhinha|CDM|POR|82|s; Enzo Barrenechea|CDM|ARG|78; Fredrik Aursnes|RB|NOR|80; Georgiy Sudakov|CAM|UKR|80;
      Claudio Echeverri|CAM|ARG|77|L; Dodi Lukébakio|RW|BEL|79|dL; Gianluca Prestianni|RW|ARG|75|L; Jakub Kamiński|LW|POL|77;
      Andreas Schjelderup|LW|NOR|77; Vangelis Pavlidis|ST|GRE|81; Jhon Durán|ST|COL|79|d`],
    ['FC Porto', 'FCP', ['#0a3d91', W, 'stripes', '#0a3d91', '#0a3d91'], `
      Diogo Costa|GK|POR|86; Cláudio Ramos|GK|POR|72; Jakub Kiwior|CB|POL|79|L; Jan Bednarek|CB|POL|78;
      Nehuén Pérez|CB|ARG|77; Martim Fernandes|RB|POR|78; Alberto Costa|RB|POR|76; Francisco Moura|LB|POR|76|L;
      Alan Varela|CDM|ARG|80; Seko Fofana|CM|CIV|80|d; Hwang In-beom|CM|KOR|79; Victor Froholdt|CM|DEN|77;
      Gabri Veiga|CM|ESP|80; Pepê|RW|BRA|78|m; William Gomes|RW|BRA|77|mL; Borja Sainz|LW|ESP|76|L;
      Samu Aghehowa|ST|ESP|82|d; Santiago Giménez|ST|MEX|79; André Silva|ST|POR|77`],
    ['Sporting CP', 'SCP', ['#008057', W, 'hoops', B, '#008057'], `
      Rui Silva|GK|POR|81; Gonçalo Inácio|CB|POR|82|L; Zeno Debast|CB|BEL|79; Eduardo Quaresma|CB|POR|78|m;
      Iván Fresneda|RB|ESP|76; Maxi Araújo|LB|URU|79|L; Sergi Altimira|CDM|ESP|75; Silas Andersen|CM|DEN|72;
      Vladan Kovačević|GK|BIH|75; Matheus Reis|LB|BRA|75|mL; João Simões|CM|POR|74; Rodrigo Zalazar|CAM|URU|80|L; Nestory Irankunda|RW|AUS|73|df; Luis Suárez|ST|COL|81|m; Fotis Ioannidis|ST|GRE|79`],
  ],
  NED: [
    ['PSV', 'PSV', ['#ed1c24', W, 'stripes', B, '#ed1c24'], `
      Matěj Kovář|GK|CZE|78; Ryan Flamingo|CB|NED|78|dL; Armando Obispo|CB|NED|77|d; Yarek Gasiorowski|CB|ESP|75|L;
      Lutsharel Geertruida|RB|NED|77|d; Sergiño Dest|RB|USA|78|d; Mauro Júnior|LB|BRA|76|m; Jerdy Schouten|CDM|NED|80|s;
      Kodai Sano|CM|JPN|74; Guus Til|CAM|NED|79|s; Sven Mijnans|CAM|NED|77; Ivan Perišić|LW|CRO|78|L;
      Filip Kostić|LW|SRB|76|L; Sami Ouaissa|LW|MAR|74|m; Dennis Man|RW|ROU|78|L; Ricardo Pepi|ST|USA|78|m;
      Sam Lammers|ST|NED|75`],
    ['Ajax', 'AJA', [W, '#d2122e', 'centre', W, W], `
      Marc-André ter_Stegen|GK|GER|83; Remko Pasveer|GK|NED|73; Thilo Kehrer|CB|GER|76|m; Youri Baas|CB|NED|77|L;
      Daley Blind|CB|NED|74|Ls; Anton Gaaei|RB|DEN|77|d; Caio Henrique|LB|BRA|76|mL; Owen Wijndal|LB|NED|73|L;
      Sofyan Amrabat|CDM|MAR|77|m; Yves Bissouma|CDM|MLI|77|d; Kenneth Taylor|CM|NED|79|L; Davy Klaassen|CM|NED|76|s;
      Julian Brandt|CAM|GER|80; Oscar Gloukh|CAM|ISR|78; Steven Berghuis|RW|NED|76|L; Viktor Tsygankov|RW|UKR|77|L;
      Simon Adingra|LW|CIV|77|df; Marcos Leonardo|ST|BRA|77|m; Kasper Dolberg|ST|DEN|75|m`],
    ['Feyenoord', 'FEY', [W, '#e3061b', 'halves', B, B], `
      Justin Bijlow|GK|NED|77; Tjark Ernst|GK|GER|74; Tsuyoshi Watanabe|CB|JPN|77; Thomas Beelen|CB|NED|75;
      Mika Mármol|CB|ESP|74|L; Givairo Read|RB|NED|75|d; Gijs Smal|LB|NED|75|L; Jordan Bos|LB|AUS|75|L;
      Oussama Targhalline|CDM|MAR|74|m; Charles Vanhoutte|CM|BEL|74; Quinten Timber|CM|NED|78|d; Sem Steijn|CAM|NED|77;
      Anis Hadj_Moussa|RW|ALG|78|mL; Gonçalo Borges|RW|POR|74|L; Reiss Nelson|LW|ENG|74|d; Nacho Ferri|ST|ESP|73`],
  ],
};

/** Parse one club's squad string into player records. */
export function parseSquad(str) {
  return str.split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
    const [name, pos, nation, ovr, flags = ''] = s.split('|');
    const words = name.trim().split(' ');
    let first = '', last;
    if (words.length === 1) last = words[0].replace(/_/g, ' ');
    else { last = words.pop().replace(/_/g, ' '); first = words.join(' '); }
    return { first, last, pos, nation, ovr: +ovr, dark: flags.includes('d'), mid: flags.includes('m'), left: flags.includes('L'), fast: flags.includes('f'), slow: flags.includes('s') };
  });
}
