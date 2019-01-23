const fs = require("fs");
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http , { wsEngine: 'ws' , pingInterval:1000});
const CasqueModel = require('jukebox-js-libs/CasqueModel');
const Swal = require("sweetalert2");

let canUseSynchro = true;

let ServerMessage=function(){
    this.id = 0;
    this.battery = false;
    this.changelanguage = false;
    this.language = "";
    this.startsession = false;
    this.stopsession = false;
    this.calibrate = false;
    this.opencalibration = false;
    this.videoPath = "";
    this.sessionDuration = -1;
    this.msg = "default";
};

class Casque extends CasqueModel{

    constructor(identifier, deviceId) {
        super(identifier, deviceId);

        let me=this;

        Casque.all.push(this);
        Casque.allByDeviceId[deviceId] = this;
        Casque.allByIdentifier[identifier] = this;

        /**
         * true si un ou des fichiers sont en cours de copie
         * @type {boolean}
         */
        this.isSynchroBusy=false;

        this.$el = null;
        this.$battery = null;
        this.$batteryLevelSize = null;
        this.$batteryText = null;
        this.$playCurrent = null;
        this.$playTotal = null;
        this.$playProgress = null;
        this.$contenuName = null;
        this.$contenuImg = null;
        this.$adb=null;
        this.$socket=null;
        this.$synchroBusy=null;
        this.$synchro=null;
        //ajoute le casque dans le HTML

        //référence les objets DOM
        me.$el = window.ui.$template("jukebox/casque/casque.html");
        me.$el.attr("data-casque", me.identifier);
        me.$el.find(".identifier").text(me.identifier);
        this.$battery = me.$el.find(".battery");
        this.$batteryLevelSize = me.$el.find(".battery .level .level-size");
        this.$batteryText = me.$el.find(".battery .text");
        this.$playTotal = me.$el.find(".play-total-time");
        this.$playCurrent = me.$el.find(".play-current-time");
        this.$playProgress = me.$el.find(".play-progress");
        this.$contenuName = me.$el.find(".contenu-name");
        this.$contenuImg = me.$el.find(".img");
        this.$adb = me.$el.find(".adb");
        this.$socket = me.$el.find(".socket");
        this.$synchro = me.$el.find(".synchro");
        this.$synchroBusy = me.$el.find(".synchroBusy");
        window.ui.setImgSrc("jukebox/casque/placeholder.jpg", this.$contenuImg);
        me.$el.on("click", function () {
            me.toggleSelected()
        });

        window.ui.addCasque(this);
        setInterval(function () {
            me.socketConnected--;
            me.refreshDisplay();
        }, 100);

        if(Casque.isTestingMode){
            me.adbConnected=true;
            me.socketConnected=2000;
            me.isSyncro=true;
        }

    }

    /**
     * Ajoute le contenu sur le casque
     * @param {ContenuModel} contenu
     * @param {function} onComplete appelé quand c'est ok
     */
    addContenu(contenu,onComplete){
        alert("add contenu !!");
        let me=this;
        let files=[];
        files.push(contenu.localFileAbsolute);
        let toCopy=files.length;
        /**
         * Teste si tous les fichiers sont copiés
         */
        let testFinished=function(){
            if(toCopy<=0){
                onComplete();
            }
        };

        for(let file of files){
            if(this._fileExists(file)){
               toCopy--;
                testFinished();
            }else{
                this._adbPushFile(
                    file
                    ,function(){
                        console.log("copie en cours "+file+" sur casque "+me.identifier);
                    },
                    function(){
                        toCopy--;
                        console.log("copie terminée de "+file+" sur casque "+me.identifier);
                        testFinished();
                    }
                );
            }

        }




    }

    /**
     * Teste si un fichier existe
     * @param {string} file
     * @return {bool}
     * @private
     */
    _fileExists(file){
       return this._files.indexOf(file)> -1;
    }


    /**
     *
     * @private
     */
    _adbPushFile(filePath, onProgress, onComplete){
        let me=this;
        let stats = fs.statSync(window.machine.appStoragePath+"/"+filePath,'/sdcard/Download/'+filePath);
        let fileSizeInBytes = stats["size"];




        if(!this._fileExists(filePath)){


            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false
            });

            var percentagePopUp = Toast.fire({
                type: 'info',
                title: 'Transfert en cours'
            });




            console.log("copie "+filePath + "sur " + me.deviceId);
            console.log("File exist pas !");
            me.isSynchroBusy=true;
            Casque.adbClient.push(me.deviceId, window.machine.appStoragePath+"/"+filePath,'/sdcard/Download/'+filePath)
                .then(function (transfer) {
                    return new Promise(function (resolve, reject) {
                        transfer.on('progress', function (stats) {
                            console.log('[%s] Pushed %d bytes so far for %d bytes',
                                me.deviceId,
                                stats.bytesTransferred,
                                fileSizeInBytes);


                            var percentage = ( stats.bytesTransferred/fileSizeInBytes)*99;
                            percentagePopUp.update({
                                title: "Copie sur casque "+me.identifier+": "+Math.floor(percentage)+"%"
                            })

                        });
                        transfer.on('end', function () {
                            console.log('[%s] Push complete', me.deviceId);
                            me.isSynchroBusy=false;
                            canUseSynchro = true;

                            percentagePopUp.close();


                            Toast.fire({
                                type: 'success',
                                title: 'Expériences synchronisées!',
                                timer: 3000
                            });

                            resolve()
                        });
                        transfer.on('error', reject)
                    })
                })
                .catch(function(error){
                    console.error("erreur transfer = ",error);
                    me.isSynchroBusy=false;
                    canUseSynchro = true;
                });
        }else{
            me.isSynchroBusy=false;
            canUseSynchro = true;
        }
    }

    /**
     *
     * @private
     */
    _adbDelete(filePath , onComplete){

        let me=this;


        if(this._fileExists(filePath)){


            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false
            });


            console.log("remove "+filePath);

            Casque.adbClient.shell(me.deviceId, 'rm -f '+'/sdcard/Download/'+filePath, function(err, output){

                //console.log("delete outpout" , output );
                if ( err === null )
                {
                    console.log("Delete Successeful " , filePath);
                    me.isSynchroBusy=false;
                    canUseSynchro = true;
                    Toast.fire({
                        type: 'success',
                        title: 'Expériences supprimées!',
                        timer: 3000
                    });
                }
                else
                {
                    console.log("delete = " ,err );
                    me.isSynchroBusy=false;
                    canUseSynchro = true;
                }


            });
            //this.isCop
            //do it
        }
    }

    /**
     *
     * @private
     */
    _adbGetFiles(Path){

    }

    /**
     *
     * Génère de fausses données pour tester
     * @private
     */
    _fakeData() {
        if(Math.random()>0.99){
            this.adbConnected=!this.adbConnected;
        }
        if(Math.random()>0.99){
            this.socketConnected=2000;
        }
        if(Math.random()>0.99){
            this.isSyncro=!this.isSyncro;
        }
        this.isSynchroBusy=!this.isSyncro;

        if (this.isCharging) {
            this.batteryLevel += Math.random() * 0.3;
        } else {
            this.batteryLevel -= Math.random() * 0.3;
        }
        this.batteryLevel = Math.max(0, this.batteryLevel);
        this.batteryLevel = Math.min(100, this.batteryLevel);
        if (Math.random() > 0.99) {
            this.isCharging = !this.isCharging;
        }

        //play progress
        if (this.contenu) {
            /*
             if(Math.random()>0.999){
             this.playTime=0;
             this.totalTime=Math.round(60+Math.random()*(60*2));
             }
             */
            this.playTime += 1;
            this.playTime = Math.min(this.totalTime, this.playTime);

        }

    }

    /**
     * Renvoie true si le casque est sélectionné
     * @return {boolean}
     */
    isSelected() {
        return this.$el.is('.selected');
    }

    /**
     * Défini le contenu du casque
     * @param {ContenuModel} contenu
     */
    setContenu(contenu) {
        this.contenu = contenu;
        //teste si le fichier est sur le casque
        if(!Casque.isTestingMode){
            if(!this._fileExists(contenu.localFile)){
                Swal.fire("Oops!", "Le contenu sélectionné n'est pas sur le casque "+this.identifier+"!", "error");
                return;
            }
        }

        if (this.contenu) {
            this.playTime = 0;
            this.totalTime = 60;
            this.$contenuImg.attr("src", this.contenu.localThumbAbsolute);
            this.$contenuName.text(this.contenu.name);
        } else {
            this.$contenuImg.attr("src", "jukebox/casque/placeholder.jpg");
            this.$contenuName.text(this.contenu.name);
        }
        var tmp = new ServerMessage();
        tmp.id = this.identifier;
        tmp.videoPath = contenu.localFile;
        io.to(this.sockID).emit('chat' , tmp );

    }

    /**
     * Rafraichit l'affichage html du casque
     */
    refreshDisplay() {

        if ( this.socketConnected > 0 )
        {
            this.displayBattery();
            this.displayPlayProgress();
        }

        if(this.adbConnected){
            this.$adb.addClass("active");
        }else{
            this.$adb.removeClass("active");
        }
        if(this.socketConnected>0){
            this.$socket.addClass("active");
        }else{
            this.$socket.removeClass("active");
        }
        if(this.isSynchroBusy){
            this.$synchroBusy.addClass("active");
        }else{
            this.$synchroBusy.removeClass("active");
        }
        if(this.isSyncro){
            this.$synchro.addClass("active");
        }else{
            this.$el.removeClass("selected");
            this.$synchro.removeClass("active");
        }

        if ( this.socketConnected>0 && this.isSyncro)
        {
            this.$el.removeClass("disabled");
        }else{
            this.$el.addClass("disabled");
        }
        if(this.contenu){
            this.$el.addClass("has-contenu");
        }else{
            this.$el.removeClass("has-contenu");
        }

        if(this.playTime ===0 )
        {
            this.$el.addClass("is-available");
        }
        else
        {
            this.$el.removeClass("is-available");
        }
    }

    /**
     * Affiche le niveau de batterie et si c'est en charge ou non
     * @private
     */
    displayBattery() {
        let level = Math.round(this.batteryLevel);
        if (this.isCharging) {
            this.$battery.addClass("charging");
        } else {
            this.$battery.removeClass("charging");
        }
        this.$batteryText.text(level + "%");
        this.$battery.attr("data-level", Math.round(level / 10) * 10);
        this.$batteryLevelSize.css("height",""+level+"%");
    }

    /**
     * Affiche l'état de lecture
     * @private
     */
    displayPlayProgress() {
        this.$playTotal.text(Casque.toMM(this.totalTime, false));
        //this.$playCurrent.text(Casque.toMM(this.playTime, false));
        this.$playCurrent.text(Casque.toHHMMSS(this.totalTime-this.playTime, false));
        //this.$playProgress.css("width", "" + (100 / this.totalTime * this.playTime) + "%")
        if ( this.playTime === 0 )
        {
            this.$playProgress.css(
                {
                    'opacity':0.75,
                    'width': '0'
                })
        }
        else
        {
            this.$playProgress.css(
                {
                    'opacity':0.75,
                    'width': ''+ 100 - (100 / this.totalTime * this.playTime) + '%'
                })
        }

    }

    /**
     * Selectionne ou désélection le casque
     */
    toggleSelected() {
        this.$el.toggleClass("selected");
        Casque._onSelectCasques();
    }


    /**
     * Convertit des secondes en heures minutes secondes
     * @private
     * @param timeSeconds
     * @param h
     * @param m
     * @param s
     * @returns {string}
     */
    static toHHMMSS(timeSeconds, h = true, m = true, s = true) {
        var sec_num = parseInt(timeSeconds, 10); // don't forget the second param
        var hours = Math.floor(sec_num / 3600);
        var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
        var seconds = sec_num - (hours * 3600) - (minutes * 60);

        if (hours < 10) {
            hours = "0" + hours;
        }
        if (minutes < 10) {
            minutes = "0" + minutes;
        }
        if (seconds < 10) {
            seconds = "0" + seconds;
        }
        let r = [];
        if (h) {
            r.push(hours);
        }
        if (m) {
            r.push(minutes);
        }
        if (s) {
            r.push(seconds);
        }

        return r.join(":");
    }
    /**
     * Convertit des secondes en Minutes
     * @private
     * @returns {string}
     */
    static toMM(timeSeconds, h = true, m = true, s = true) {
        return Math.round(timeSeconds / 60);
    }


    //-----------------statiques---------------------------------------

    /**
     * Retourne un Casque par son numéro.
     * Il faut que le casque soit référencé préalablement pour que ça marche
     * @param identifier
     * @returns {Casque|null}
     */
    static getCasqueByIdentifier(identifier) {
        if (Casque.allByIdentifier[identifier]) {
            return Casque.allByIdentifier[identifier];
        }
        console.error("Le casque ayant pour numéro "+identifier+" n'existe pas");
        return null;
    }

    /**
     * Retourne un Casque par son id ADB.
     * - Si le casque est instancié, le renvoie
     * - Si le casque est dans le json mais pas instancié, l'instancie et le renvoie
     * - Si le casque n'existe pas dans le json demandera à l'utilisateur son numéro, enregistrera le json, l'instanciera et le renverra
     * @param {string} deviceId L'identifiant ADB
     * @return {Casque}
     */
    static getCasqueByDeviceId(deviceId) {
        console.log("deviceId", deviceId);
        if (Casque.allByDeviceId[deviceId]) {
            return Casque.allByDeviceId[deviceId];
        }
        if (Casque.configJson.casques[deviceId]) {
            return new Casque(Casque.configJson.casques[deviceId].identifier, deviceId);
        }
        else {
            const dialog = require('electron').remote.dialog;
            const options = {
                type: 'question',
                buttons: ["annuler",'1', '2', '3', '4', '5'],
                defaultId: 5,
                title: 'Question',
                message: 'Veuillez inquer le numéro du casque que vous vennez de brancher pour la première fois'
            };
            dialog.showMessageBox(null, options, (response) => {
                if (response === 0) {
                    return null;
                }else {
                    let s = "000000" + response;
                    s = s.substr(s.length-2);
                    Casque.configJson.casques[deviceId] = {
                        "identifier":s
                    };
                    Casque._saveConfig();
                    return Casque.getCasqueByDeviceId(deviceId);
                }
            });
        }
    }

    /**
     * Initialise la liste des casques, lance les écouteurs ADB et socket etc...
     */
    static initAll() {
        //teste si le json existe
        if (!fs.existsSync(window.machine.jsonCasquesConfigPath)) {
            //save le config vierge
            Casque._saveConfig();
            return Casque.initAll(); //appel récursif
        }
        let json = fs.readFileSync(window.machine.jsonCasquesConfigPath);
        json=JSON.parse(json);
        //teste si la structure du json est correcte
        if(typeof json !== 'object' || !json.casques){
            //si incorrecte efface le json et le recréra proprement au prochaiun appel.
            fs.unlinkSync(window.machine.jsonCasquesConfigPath);
            return Casque.initAll(); //appel récursif
        }

        //si tout va bien on va utiliser la config chargée
        Casque.configJson = json;

        //initialise les casques à partir de ce qui a été trouvé dans le json
        for (let deviceId in Casque.configJson.casques) {
            if (!Casque.configJson.casques.hasOwnProperty(deviceId)) continue;
            Casque.getCasqueByDeviceId(deviceId);
        }
        //initilise les écouteurs ADB
        Casque._initADB();
        //initialise les échanges socket
        setTimeout(function(){

            Casque._initSocket();

        }, 1000);

    }

    /**
     * Initialise l'écoute ADB
     */
    static _initADB() {
        let adb = require('adbkit');
        let Promise = require('bluebird');
        Casque.adbClient = adb.createClient();
        Casque.adbClient.trackDevices()

            .then(function (tracker) {
                tracker.on('add', function (device) {

                    console.log('Device %s was plugged in', device.id);

                    let casque=Casque.getCasqueByDeviceId(device.id);
                    casque.adbConnected=true;
                    casque.refreshDisplay();
                    //casque._syncContenus();

                });
                tracker.on('remove', function (device) {
                    console.log('Device %s was unplugged', device.id)
                    let casque=Casque.getCasqueByDeviceId(device.id);
                    casque.adbConnected=false;
                    if ( casque.isSynchroBusy )
                    {
                        casque.isSynchroBusy=false;
                        canUseSynchro = true;
                    }


                    casque.refreshDisplay();
                });
                tracker.on('end', function () {
                    console.log('Tracking stopped')
                });
            })
            .catch(function (err) {
                console.error('Something went wrong:', err.stack)
            });

    }

    /**
     * initialise les sockets des casques
     * @private
     */
    static _initSocket(){


        http.listen(3000, function(){
            console.log('listening on *:3000');
        });

        io.on('connection', function(socket){
            let identifier = socket.handshake.address.toString().substring(socket.handshake.address.toString().length-2 , socket.handshake.address.toString().length);
            console.log("device connected " + identifier);
            let casque = Casque.getCasqueByIdentifier(identifier);
            if(!casque){
                return;
            }
            casque.sockID = socket.id;
            io.to(socket.id).emit('setid', identifier );



            setTimeout(function(){
                var tmp = new ServerMessage();
                tmp.id = identifier;
                tmp.msg = "Connected to server !";
                io.emit( 'chat', tmp )
            }, 500);




            socket.on('chat', function(msg){ // exemple receive

                //io.emit('chat', msg); // exemple emit
                var json = JSON.parse(msg);
                //console.log("msg json from ", json.id," = ",json);
                //let casque = Casque.getCasqueByIdentifier(json.id);
                if(casque){
                    casque.socketConnected=1000;
                    if(json.batterylevel){
                        casque.batteryLevel=json.batterylevel;
                    }
                    if ( json.currentPlayTime > -1 ){
                        //console.log("json.currentPlayTime = " + json.currentPlayTime);
                        casque.playTime = json.currentPlayTime;
                    }

                    if ( json.totalPlaytime > 0 ){
                        //console.log("json.totalPlaytime = " + json.totalPlaytime);
                        casque.totalTime = json.totalPlaytime;
                    }


                    if ( json.fileList && json.fileList.length)
                    {
                        casque._files =json.fileList;
                        //console.log(casque._files);
                        for ( let i = 0 ; i<casque._files.length ;  i++)
                        {
                            casque._files[i] =casque._files[i].split("\\").join("/");
                        }
                    }
                    else
                    {
                        casque._files = null;
                    }

                    if ( json.msg === "Application Pause")
                    {
                        casque.socketConnected=0;
                    }



                    casque._syncContenus();

                    //console.error(casque._files);
                    casque.refreshDisplay();
                }



            });

            socket.on('disconnect', function(){
                let casque = Casque.getCasqueByIdentifier(identifier);
                if(casque){
                    casque.socketConnected = 0;
                    console.log('user disconnected '+ identifier);
                }

            });


        });


    }

    /**
     * Enregistre la configuration des casques dans le json
     * @private
     */
    static _saveConfig() {
        console.log("Enregistre le json de config des casques",Casque.configJson);
        fs.writeFileSync(window.machine.jsonCasquesConfigPath, JSON.stringify(Casque.configJson,undefined, 2));
    }

    /**
     * Renvoie la liste des casques selectionnés dans l'ui
     * @returns {Casque[]}
     */
    static selecteds() {
        let r = [];
        for (let c of Casque.all) {
            if (c.isSelected()) {
                r.push(c);
            }
        }
        return r;
    }

    /**
     * Déselectionne tous les casques
     */
    static unselectAll() {
        for (let c of Casque.all) {
            c.$el.removeClass("selected");
        }
        Casque._onSelectCasques();
    }

    /**
     * Appellé quand un casque est sélectionné ou déselectioné, fait apparaitre ou disparaitre le menu d'actions play / pause
     * @private
     */
    static _onSelectCasques(){
        let active=Casque.selecteds().length > 0;
        window.ui.activeActionMenu(active);
    }

    /**
     * Attribue le contenu donné à tous les casques selectionnés
     * @param {ContenuModel} contenu
     */
    static setContenuSelecteds(contenu) {

        for (let c of Casque.selecteds()) {
            if( c.playTime != 0 )
            {
                Swal.fire("Oops!", "Veuillez stopper les séances avant ça!", "error");
                return;
            }
        }

        if ( Casque.selecteds().length === 0 )
        {
            Swal.fire("Oops!", "Veuillez sélectionner des casques avant ça!", "error");
            return;
        }


        Swal.fire({
            title: "Êtes vous sur?",
            text: "Modifier le contenu des casques sélectionnés?",
            type: "question",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Oui",
            cancelButtonText: "Non"
        })
            .then(validPlay => {

                if (validPlay.value ) {


                    Swal.fire({
                        title: "Validé!",
                        html: "Le contenu à bien été attribué",
                        timer: 2000,
                        type:"success",
                        showConfirmButton: false

                    });

                    for (let c of Casque.selecteds()) {
                        c.setContenu(contenu);
                    }
                }
                else {
                    return;
                }
            });
    }

    /**
     * Enregistre dans le json quels contenus sont sensés etre sur les casques
     * @param {array} contenus Liste des fichiers à copier sur les casques
     */
    static setFilesOnCasques(contenus){
        console.log("setFilesOnCasques");
        Casque.configJson.contenusCopied=contenus;
        Casque._saveConfig();

    }

    /**
     * Reboot tous les casques
     */
    static rebootAll(){

        let Promise = require('bluebird');
        let adb = require('adbkit');
        let client = adb.createClient();


        Casque.adbClient.listDevices()
            .then(function(devices) {
                return Promise.map(devices, function(device) {
                    return client.reboot(device.id)
                })
            })
    }

    /**
     * Synchronise les contenus qui doivent l'être sur le casques
     */
    _syncContenus(){
        let casque=this;
        let localsynchro = true;

        if ( this.isSynchroBusy )
        {
            return false;
        }

        if ( this._files === null )
        {
            this.isSyncro = false;
            return false;
        }

        //console.log("Synchro contenu ?");
        //console.log("Casque.configJson.contenusCopied",Casque.configJson.contenusCopied);
        //console.log("casque._files",casque._files);

        //ajoute les fichiers
        for (var file in Casque.configJson.contenusCopied) {
            if (Casque.configJson.contenusCopied.hasOwnProperty(file)) {
                if(!this._fileExists(file)){
                    localsynchro = false;
                    if ( canUseSynchro === false )
                    {
                        this.isSyncro = false;
                        return false;
                    }
                    if(this.adbConnected){
                        console.log("Ajout de contenu");
                        this.isSynchroBusy= true;
                        canUseSynchro = false;

                        casque._adbPushFile(file);
                        return false;
                    }
                }
            }
        }


        //efface les fichiers innutiles
        for (var casqueFile of casque._files) {
                if (!Casque.configJson.contenusCopied[casqueFile]) {
                    if(this._fileExists(file)) {
                        localsynchro = false;
                        if ( canUseSynchro === false )
                        {
                            this.isSyncro = false;
                            return false;
                        }
                        if(this.adbConnected) {
                            console.log("Suppression contenu");
                            this.isSynchroBusy = true;
                            canUseSynchro = false;
                            casque._adbDelete(casqueFile);
                            return false;
                        }

                    }
                }
        }

        this.isSyncro=localsynchro;
        console.log("Synchro Ok");



        this.refreshDisplay();
        return true;
    }

    /**
     * Dit si un contenu est copié sur tous les casques ou pas
     * (se base sur le json pour dire ça)
     * @param {ContenuModel} contenu
     * @returns {boolean}
     */
    static isContenuCopied(contenu){
        let r = Casque.configJson.contenusCopied[contenu.localFile]? true : false;
        //console.log("isContenuCopied",r);
        return r
    }

    /**
     * Demande comfirmation pour lancer la commande de lecture sur tous les casques selectionnés
     * @param {string|int} duration soit la durée en secondes, soit "loop" soit rien pour jouer une seule fois.
     */
    static playAllSelected(duration){
        //todo victor prendre en charge le paramètre duration

        var tmp = new ServerMessage();




        Swal.fire({
            title: "Êtes vous sur?",
            text: "Voulez vous lancez une séance sur le casque?",
            type: "question",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Oui",
            cancelButtonText: "Non"
        })
            .then(validPlay => {

                if (validPlay.value ) {

                    switch (duration) {
                        case "":
                            Swal.fire({
                                title: "Séance lancée!",
                                html: "La séance va durée quelques minutes",
                                timer: 2000,
                                type:"success",
                                showConfirmButton: false

                            });
                            tmp.sessionDuration = -1;
                            break;
                        case "loop":
                            Swal.fire({
                                title: "Séance lancée!",
                                html: "La séance va tourner en boucle",
                                timer: 2000,
                                type:"success",
                                showConfirmButton: false

                            });
                            tmp.sessionDuration = -1;
                            break;
                        default:
                            if(isNaN(duration / 2) ){
                                Swal.fire("durée "+duration/60+"minutes pas pris en charge");
                                tmp.sessionDuration = 0;
                            }else{
                                //Swal.fire("Séance lancée!", "La séance va durée "+duration/60+" minutes", "success");
                                Swal.fire({
                                    title: "Séance lancée!",
                                    html: "La séance va durée "+duration/60+" minutes",
                                    timer: 2000,
                                    type:"success",
                                    showConfirmButton: false

                                });
                                tmp.sessionDuration = duration;
                            }
                            break;
                    }
                    Casque.playAllSelectedComfirmed(tmp);
                }
                else {
                    return;
                }
            });

    }

    /**
     * Lance la commande de lecture sur tous les casques selectionnés
     * @param {message|servermessage} message à envoyer à tous les casques .
     */
    static playAllSelectedComfirmed(message) {

        let numeros=[];
        for(let i in Casque.selecteds() ){
            let casque=Casque.selecteds()[i];
            numeros.push(casque.identifier);
            message.id = casque.identifier;
            message.startsession = true;
            io.to(casque.sockID).emit('chat' , message );
            console.error("this.sockID = ", casque.sockID, " Play");
        }

        Casque.unselectAll();
    }

    /**
     * Lance la commande de pause sur tous les casques selectionnés
     */
    static pauseAllSelected(){
        let numeros=[];

        Swal.fire({
            title: "Êtes vous certain?",
            text: "Voulez vous vraiment stopper la séance en cours?",
            type: "question",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Oui",
            cancelButtonText: "Non"
        })
            .then(validplay=> {
                if (validplay.value) {
                    Swal.fire({
                        title: "OK!",
                        html: "La séance à bien été stoppée",
                        timer: 2000,
                        type:"success",
                        showConfirmButton: false

                    });


                    for(let i in Casque.selecteds() ){
                        let casque=Casque.selecteds()[i];
                        numeros.push(Casque.selecteds()[i].identifier);
                        var tmp = new ServerMessage();
                        tmp.id = casque.identifier;
                        tmp.stopsession = true;
                        io.to(casque.sockID).emit('chat' , tmp );
                        console.error("this.sockID = ", casque.sockID, " stopped");
                    }
                }


            });


        //alert("pause sur casques "+numeros.join(" et "));
    }

    /**
     * Crée 5 casques en mode test
     */
    static performTestMode(){
        //tests only
        Casque.isTestingMode=true;
        setTimeout(function () {
            for(let i=1; i<6;i++){
                let casque=new Casque(i,Math.random());
                casque.batteryLevel=Math.random()*100;

                //window.ui.addCasque(this);
            }
            setInterval(function(){
                for (let idx in Casque.all) {
                    Casque.all[idx]._fakeData();
                }
            },1000);
        },3000);
    }


}

/**
 * Structure de ce qui est enregistré dans le json de config des casques
 * @type {{casques: {}}}
 */
Casque.configJson = {
    casques: {},
    contenusCopied:{}
};
/**
 * Tous les casques référencés
 * @type {Casque[]}
 */
Casque.all = [];
/**
 * Liste des casques indexée par deviceid (ADB)
 */
Casque.allByDeviceId = {};
/**
 *
 * Liste des casques indexée par numéros (ip, socket)
 */
Casque.allByIdentifier = {};


module.exports = Casque;





