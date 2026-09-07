const PROGRAMME={
 lundi:{name:'Fessiers & jambes',exercises:[['Hip thrust / pont fessier',3,12],['Squats',3,12],['Fentes arrière',3,10],['Donkey kicks',3,12],['Fire hydrants',3,12]]},
 mercredi:{name:'Haut du corps & poitrine',exercises:[['Pompes inclinées',3,10],['Pompes',3,8],['Chest squeeze',3,15],['Superman',3,12],['Shoulder taps',3,12]]},
 vendredi:{name:'Core & conditionnement',exercises:[['Dead bug',3,10],['Reverse crunch',3,12],['Planche',3,30],['Side plank',3,20],['Mountain climbers',3,20]]}
};
function getWorkout(){const d=new Date().getDay();return PROGRAMME[{1:'lundi',3:'mercredi',5:'vendredi'}[d]||'lundi'];}
